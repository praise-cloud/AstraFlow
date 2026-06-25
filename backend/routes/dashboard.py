import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from backend.db.database import get_db
from backend.models.user import User
from backend.models.fuel_price import FuelPrice
from backend.models.recommendation import Recommendation
from backend.services.auth import decode_access_token
from backend.services.scraper import fetch_retail_prices
from backend.services.oil_price_api import fetch_global_prices
from backend.ml.forecast import get_forecaster

router = APIRouter(prefix="/api", tags=["dashboard"])

_scraped = False


def _ensure_prices_scraped(db: Session):
    global _scraped
    if _scraped:
        return
    existing = db.query(FuelPrice).count()
    if existing > 10:
        _scraped = True
        return
    prices = fetch_retail_prices()
    for p in prices:
        existing_record = (
            db.query(FuelPrice)
            .filter(FuelPrice.date == p["date"].date(), FuelPrice.fuel_type == "petrol")
            .first()
        )
        if existing_record:
            continue
        db.add(FuelPrice(date=p["date"].date(), fuel_type="petrol", price=p["petrol"]))
        db.add(FuelPrice(date=p["date"].date(), fuel_type="diesel", price=p["diesel"]))
    db.commit()
    _scraped = True


def get_current_user(authorization: str = Header(...), db: Session = Depends(get_db)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.split(" ")[1]
    user_id = decode_access_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def _get_latest_prices(db: Session) -> dict:
    petrol = (
        db.query(FuelPrice)
        .filter(FuelPrice.fuel_type == "petrol")
        .order_by(FuelPrice.date.desc())
        .first()
    )
    diesel = (
        db.query(FuelPrice)
        .filter(FuelPrice.fuel_type == "diesel")
        .order_by(FuelPrice.date.desc())
        .first()
    )
    return {
        "petrol": float(petrol.price) if petrol else None,
        "diesel": float(diesel.price) if diesel else None,
        "petrol_date": str(petrol.date) if petrol else None,
        "diesel_date": str(diesel.date) if diesel else None,
    }


def _get_trend(db: Session) -> dict:
    petrol_records = (
        db.query(FuelPrice)
        .filter(FuelPrice.fuel_type == "petrol")
        .order_by(FuelPrice.date.desc())
        .limit(2)
        .all()
    )
    diesel_records = (
        db.query(FuelPrice)
        .filter(FuelPrice.fuel_type == "diesel")
        .order_by(FuelPrice.date.desc())
        .limit(2)
        .all()
    )

    def calc(fuel_records):
        if len(fuel_records) < 2:
            return {"direction": "stable", "change": 0}
        newer = float(fuel_records[0].price)
        older = float(fuel_records[1].price)
        change = ((newer - older) / older) * 100
        direction = "up" if change > 0.5 else "down" if change < -0.5 else "stable"
        return {"direction": direction, "change": round(abs(change), 1)}

    return {
        "petrol": calc(petrol_records),
        "diesel": calc(diesel_records),
    }


def _get_recommendation(db: Session, business_type: str) -> dict:
    rec = (
        db.query(Recommendation)
        .filter(
            Recommendation.business_type == business_type,
            Recommendation.valid_from <= datetime.now(timezone.utc).date(),
        )
        .order_by(Recommendation.valid_from.desc())
        .first()
    )
    if not rec:
        return {
            "title": "Monitor Prices",
            "content": "No recommendation available for your business type at this time.",
            "risk_level": "Moderate",
            "impact": "Medium",
        }
    return {
        "title": rec.content.split(".")[0],
        "content": rec.content,
        "risk_level": rec.risk_level,
    }


@router.get("/dashboard")
def get_dashboard(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _ensure_prices_scraped(db)

    prices = _get_latest_prices(db)
    trend = _get_trend(db)
    rec = _get_recommendation(db, user.business_type.value)

    petrol_price = prices["petrol"]
    diesel_price = prices["diesel"]
    if petrol_price is None or diesel_price is None:
        raise HTTPException(status_code=503, detail="Fuel price data not yet available")

    try:
        forecaster = get_forecaster()
        forecast_data = forecaster.forecast(days=7, fuel_type="petrol")
        evaluation = forecast_data.get("evaluation", {"mae": 0, "rmse": 0, "r2": 0})
        model_name = forecast_data.get("model", "Linear Regression (numpy)")
    except ValueError:
        evaluation = {"mae": 0, "rmse": 0, "r2": 0}
        model_name = "Insufficient data"

    last_change = trend["petrol"]["direction"]
    if last_change == "up":
        market_update = (
            f"Petrol increased to Rs {petrol_price:.2f}/L on {prices['petrol_date']}. "
            f"Global crude supply fluctuations are driving local price adjustments."
        )
    elif last_change == "down":
        market_update = (
            f"Petrol decreased to Rs {petrol_price:.2f}/L on {prices['petrol_date']}. "
            f"Market conditions show easing pressure on fuel prices."
        )
    else:
        market_update = (
            f"Petrol stable at Rs {petrol_price:.2f}/L as of {prices['petrol_date']}. "
            f"Global crude supply fluctuations are being monitored."
        )

    global_prices = fetch_global_prices()

    return {
        "current_price": {
            "petrol": petrol_price,
            "diesel": diesel_price,
            "currency": "MUR",
            "unit": "L",
        },
        "global_crude": {
            "brent_usd": global_prices["brent"],
            "wti_usd": global_prices["wti"],
            "diesel_global_usd": global_prices["diesel_global"],
            "gasoline_global_usd": global_prices["gasoline_global"],
            "updated_at": global_prices["updated_at"],
            "source": global_prices["source"],
        },
        "trend": {
            "petrol": trend["petrol"]["direction"],
            "petrol_change": trend["petrol"]["change"],
            "diesel": trend["diesel"]["direction"],
            "diesel_change": trend["diesel"]["change"],
        },
        "risk_level": rec.get("risk_level", "Moderate"),
        "impact_score": rec.get("impact", "Medium"),
        "recommendation": {
            "title": rec["title"],
            "content": rec["content"],
        },
        "market_update": market_update,
        "business_type": user.business_type.value,
        "user_name": user.full_name,
        "model": model_name,
        "evaluation": evaluation,
    }
