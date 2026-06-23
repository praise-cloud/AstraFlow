from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from backend.db.database import get_db
from backend.models.survey import Survey
from backend.models.user import User
from backend.routes.dashboard import get_current_user

router = APIRouter(prefix="/api/surveys", tags=["surveys"])


class SurveySubmit(BaseModel):
    monthly_fuel_spend: Optional[float] = None
    impact_level: Optional[str] = None
    concern_areas: Optional[list[str]] = None
    comments: Optional[str] = None


@router.post("")
def submit_survey(
    body: SurveySubmit,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    survey = Survey(
        user_id=user.id,
        business_type=user.business_type,
        monthly_fuel_spend=body.monthly_fuel_spend,
        impact_level=body.impact_level,
        concern_areas=body.concern_areas,
        comments=body.comments,
    )
    db.add(survey)
    db.commit()
    db.refresh(survey)
    return {"id": survey.id, "message": "Survey submitted successfully"}


@router.get("")
def list_surveys(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    surveys = (
        db.query(Survey)
        .filter(Survey.user_id == user.id)
        .order_by(Survey.submitted_at.desc())
        .all()
    )
    return [
        {
            "id": s.id,
            "business_type": s.business_type.value,
            "monthly_fuel_spend": float(s.monthly_fuel_spend) if s.monthly_fuel_spend else None,
            "impact_level": s.impact_level,
            "concern_areas": s.concern_areas,
            "comments": s.comments,
            "submitted_at": s.submitted_at.isoformat(),
        }
        for s in surveys
    ]


@router.get("/insights")
def survey_insights(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    total = db.query(Survey).count()
    by_impact = (
        db.query(Survey.impact_level, Survey.business_type)
        .all()
    )

    impact_counts: dict[str, int] = {}
    for level, _ in by_impact:
        if level:
            impact_counts[level] = impact_counts.get(level, 0) + 1

    user_surveys = (
        db.query(Survey)
        .filter(Survey.user_id == user.id)
        .order_by(Survey.submitted_at.desc())
        .limit(5)
        .all()
    )

    return {
        "total_surveys": total,
        "impact_distribution": impact_counts,
        "user_recent": [
            {
                "id": s.id,
                "impact_level": s.impact_level,
                "monthly_fuel_spend": float(s.monthly_fuel_spend) if s.monthly_fuel_spend else None,
                "concern_areas": s.concern_areas,
                "submitted_at": s.submitted_at.isoformat(),
            }
            for s in user_surveys
        ],
    }
