from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from backend.db.database import get_db
from backend.models.user import User, BusinessType
from backend.services.auth import decode_access_token
from backend.ml.forecast import get_forecaster

router = APIRouter(prefix="/api", tags=["dashboard"])


def get_current_user(authorization: str = Header(...), db: Session = Depends(get_db)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.split(" ")[1]
    user_id = decode_access_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


RECOMMENDATIONS = {
    BusinessType.RESTAURANT: {
        "recommendation": "Review supplier contracts early — fuel-related transport costs may increase next month.",
        "impact": "Medium",
        "risk": "Moderate",
    },
    BusinessType.TAXI: {
        "recommendation": "Estimated fuel spending next month: Rs 12,000. Expected increase: Rs 1,500.",
        "impact": "High",
        "risk": "Moderate",
    },
    BusinessType.DELIVERY: {
        "recommendation": "Optimize delivery routes to reduce fuel consumption. Costs expected to rise 5-7%.",
        "impact": "High",
        "risk": "High",
    },
    BusinessType.RETAIL: {
        "recommendation": "Monitor supply chain fuel surcharges. Consider bulk ordering to lock in current rates.",
        "impact": "Low",
        "risk": "Low",
    },
    BusinessType.LOGISTICS: {
        "recommendation": "Fuel costs projected to increase 8% next quarter. Evaluate fleet efficiency upgrades.",
        "impact": "High",
        "risk": "High",
    },
}


@router.get("/dashboard")
def get_dashboard(user: User = Depends(get_current_user)):
    biz_type = user.business_type
    info = RECOMMENDATIONS.get(biz_type, RECOMMENDATIONS[BusinessType.RESTAURANT])

    forecaster = get_forecaster()
    forecast_data = forecaster.forecast(days=7, fuel_type="petrol")
    evaluation = forecast_data.get("evaluation", {"mae": 0, "rmse": 0, "r2": 0})
    model_name = forecast_data.get("model", "Linear Regression (numpy)")

    return {
        "current_price": {
            "petrol": 1.64,
            "diesel": 1.78,
            "currency": "USD",
            "unit": "L",
        },
        "trend": {
            "petrol": "down",
            "petrol_change": 0.2,
            "diesel": "up",
            "diesel_change": 0.5,
        },
        "risk_level": info["risk"],
        "impact_score": info["impact"],
        "recommendation": {
            "title": info["recommendation"].split(".")[0],
            "content": info["recommendation"],
        },
        "market_update": "Global crude supply fluctuations are driving local price hikes.",
        "business_type": biz_type.value,
        "user_name": user.full_name,
        "model": model_name,
        "evaluation": evaluation,
    }
