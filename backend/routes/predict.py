from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from typing import Optional

from backend.models.user import User
from backend.routes.dashboard import get_current_user
from backend.ml.forecast import get_forecaster

router = APIRouter(prefix="/api", tags=["predict"])


class CostProjection(BaseModel):
    current_price: float
    avg_forecast_price: float
    liters: float
    cost_now: float
    cost_forecast: float
    difference: float
    savings_tip: Optional[str] = None


@router.get("/predict")
def predict(
    liters: float = Query(..., gt=0),
    user: User = Depends(get_current_user),
):
    forecaster = get_forecaster()
    forecast = forecaster.forecast(days=30, fuel_type="petrol")

    current = forecast["current_price"]
    avg_future = forecast["avg_forecast"]

    cost_now = round(liters * current, 2)
    cost_forecast = round(liters * avg_future, 2)
    diff = round(cost_forecast - cost_now, 2)
    carbon_per_liter = 2.3
    total_carbon = round(liters * carbon_per_liter, 2)

    rec = forecast["recommendation"]

    return {
        "liters": liters,
        "price_per_liter": current,
        "total_cost": cost_now,
        "carbon_footprint_kg": total_carbon,
        "price_index": forecast["trend"].title(),
        "price_alert": rec["urgency"] == "high",
        "alert_message": rec["message"] if rec["urgency"] == "high" else None,
        "future_increase_pct": forecast["change_pct"],
        "future_loss": max(diff, 0),
        "forecast": {
            "avg_forecast_price": avg_future,
            "trend": forecast["trend"],
            "model": forecast["model"],
            "recommendation": rec,
            "evaluation": forecast.get("evaluation", {}),
            "feature_importance": forecast.get("feature_importance", {}),
        },
    }


@router.get("/forecast")
def get_forecast(
    days: int = Query(default=30, ge=7, le=90),
    fuel_type: str = Query(default="petrol", pattern="^(petrol|diesel)$"),
    user: User = Depends(get_current_user),
):
    forecaster = get_forecaster()
    return forecaster.forecast(days=days, fuel_type=fuel_type)
