import logging
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from typing import Optional

logger = logging.getLogger(__name__)

from backend.models.user import User
from backend.routes.dashboard import get_current_user
from backend.ml.forecast import get_forecaster
from backend.ml.model_manager import ModelManager
from backend.ml.trainer import retrain_in_background
from backend.ml.evaluator import get_accuracy_report

router = APIRouter(prefix="/api", tags=["predict"])


class CostProjection(BaseModel):
    current_price: float
    avg_forecast_price: float
    liters: float
    cost_now: float
    cost_forecast: float
    difference: float
    savings_tip: Optional[str] = None


def _fallback_forecast(days: int = 30, fuel_type: str = "petrol") -> dict:
    return {
        "fuel_type": fuel_type,
        "current_price": 1.60,
        "forecast_days": days,
        "trend": "stable",
        "change_pct": 0.0,
        "avg_forecast": 1.60,
        "min_forecast": 1.60,
        "max_forecast": 1.60,
        "confidence_interval": {"lower": 1.55, "upper": 1.65},
        "points": [],
        "recommendation": {
            "action": "monitor",
            "title": "Data Unavailable",
            "message": "Forecast model is still loading. Please try again shortly.",
            "urgency": "none",
        },
        "model": "Fallback",
        "evaluation": {"mae": 0, "rmse": 0, "r2": 0},
    }


_FALLBACK_CURRENT_PRICE = 1.60


@router.get("/predict")
def predict(
    liters: float = Query(..., gt=0),
    user: User = Depends(get_current_user),
):
    try:
        forecaster = get_forecaster()
        forecast = forecaster.forecast(days=30, fuel_type="petrol")
    except Exception:
        logger.exception("Predict: forecast failed, using fallback")
        forecast = _fallback_forecast(30, "petrol")

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
        },
    }


@router.get("/forecast")
def get_forecast(
    days: int = Query(default=30, ge=7, le=90),
    fuel_type: str = Query(default="petrol", pattern="^(petrol|diesel)$"),
    user: User = Depends(get_current_user),
):
    try:
        forecaster = get_forecaster()
        return forecaster.forecast(days=days, fuel_type=fuel_type)
    except Exception:
        logger.exception("Forecast endpoint failed, returning fallback")
        return _fallback_forecast(days, fuel_type)


# ------------------------------------------------------------------
# Model Management Endpoints
# ------------------------------------------------------------------


@router.get("/model/status")
def model_status(user: User = Depends(get_current_user)):
    """Return the currently active model version and metrics for both fuel types."""
    _, petrol_info = ModelManager.load_active("petrol")
    _, diesel_info = ModelManager.load_active("diesel")

    return {
        "petrol": petrol_info or {"version": None, "metrics": None, "trained_at": None, "num_samples": 0},
        "diesel": diesel_info or {"version": None, "metrics": None, "trained_at": None, "num_samples": 0},
    }


@router.get("/model/versions")
def model_versions(
    model_type: str = Query(default="petrol", pattern="^(petrol|diesel)$"),
    user: User = Depends(get_current_user),
):
    """List all saved model versions for a given fuel type."""
    versions = ModelManager.list_versions(model_type)
    return {"model_type": model_type, "versions": versions}


@router.post("/model/retrain")
def force_retrain(user: User = Depends(get_current_user)):
    """Force immediate retrain of both petrol and diesel models in the background."""
    retrain_in_background()
    return {"message": "Retraining started in the background", "status": "ok"}


@router.get("/model/accuracy")
def model_accuracy(
    days: int = Query(default=30, ge=1, le=365),
    model_type: str = Query(default="petrol", pattern="^(petrol|diesel)$"),
    user: User = Depends(get_current_user),
):
    """Return accuracy metrics for a given model type over the last N days."""
    return get_accuracy_report(model_type=model_type, days=days)


@router.post("/model/rollback/{version}")
def rollback_model(
    version: int,
    model_type: str = Query(default="petrol", pattern="^(petrol|diesel)$"),
    user: User = Depends(get_current_user),
):
    """Rollback to a specific model version for a given fuel type."""
    success = ModelManager.rollback(model_type, version)
    if not success:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Version {version} not found for {model_type}")

    # Reload forecaster so next prediction uses the rolled-back model
    forecaster = get_forecaster()
    if model_type == "petrol":
        loaded, info = ModelManager.load_active("petrol")
        if loaded:
            forecaster._petrol_model = loaded
            forecaster._petrol_info = info
    else:
        loaded, info = ModelManager.load_active("diesel")
        if loaded:
            forecaster._diesel_model = loaded
            forecaster._diesel_info = info

    return {"message": f"Rolled back {model_type} to version {version}", "status": "ok"}
