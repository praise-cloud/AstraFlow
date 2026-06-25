from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import inspect
from sqlalchemy.orm import Session

from backend.db.database import get_db, Base, engine
from backend.models.news import OilNews
from backend.routes.dashboard import get_current_user
from backend.models.user import User

router = APIRouter(prefix="/api/news", tags=["news"])


class NewsCreate(BaseModel):
    title: str
    summary: str
    content: str
    source: str
    image_url: str | None = None


def _ensure_table():
    if not inspect(engine).has_table("oil_news"):
        Base.metadata.create_all(bind=engine)


@router.get("")
def list_news(db: Session = Depends(get_db)):
    _ensure_table()
    articles = db.query(OilNews).order_by(OilNews.published_at.desc()).all()
    return [
        {
            "id": a.id,
            "title": a.title,
            "summary": a.summary,
            "content": a.content,
            "source": a.source,
            "image_url": a.image_url,
            "published_at": a.published_at.isoformat(),
        }
        for a in articles
    ]


@router.post("", status_code=201)
def create_news(
    body: NewsCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_table()
    article = OilNews(
        title=body.title,
        summary=body.summary,
        content=body.content,
        source=body.source,
        image_url=body.image_url,
        published_at=date.today(),
    )
    db.add(article)
    db.commit()
    db.refresh(article)
    return {
        "id": article.id,
        "title": article.title,
        "summary": article.summary,
        "content": article.content,
        "source": article.source,
        "image_url": article.image_url,
        "published_at": article.published_at.isoformat(),
    }
