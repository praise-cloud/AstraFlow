import logging
import uuid
from datetime import date as date_lib, datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from backend.db.database import get_db
from backend.models.user import User
from backend.models.fuel_price import FuelPrice
from backend.models.push_token import PushToken
from backend.models.price_alert import PriceAlert
from backend.models.recommendation import Recommendation
from backend.services.auth import decode_access_token
from backend.services.scraper import fetch_retail_prices
from backend.services.oil_price_api import fetch_global_prices
from backend.ml.forecast import get_forecaster
from typing import Optional
import httpx

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["dashboard"])

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

_last_stc_scrape: Optional[datetime] = None
_SCRAPE_COOLDOWN = timedelta(hours=1)


def _get_oldest_new_price(db: Session, fuel_type: str) -> Optional[float]:
    r = db.query(FuelPrice).filter(FuelPrice.fuel_type == fuel_type).order_by(FuelPrice.date.desc()).first()
    return float(r.price) if r else None


def _send_price_alerts(db: Session, old_petrol: Optional[float], old_diesel: Optional[float]):
    """Check for price changes and send push alerts to users whose thresholds are met."""
    new_petrol = _get_oldest_new_price(db, "petrol")
    new_diesel = _get_oldest_new_price(db, "diesel")

    changes = []
    if old_petrol is not None and new_petrol is not None and old_petrol != new_petrol:
        pct = round(((new_petrol - old_petrol) / old_petrol) * 100, 2)
        direction = "up" if pct > 0 else "down"
        changes.append(("petrol", old_petrol, new_petrol, pct, direction))
    if old_diesel is not None and new_diesel is not None and old_diesel != new_diesel:
        pct = round(((new_diesel - old_diesel) / old_diesel) * 100, 2)
        direction = "up" if pct > 0 else "down"
        changes.append(("diesel", old_diesel, new_diesel, pct, direction))

    if not changes:
        return

    tokens = db.query(PushToken).filter(PushToken.alerts_enabled == True).all()
    if not tokens:
        return

    for fuel_type, old_price, new_price, change_pct, direction in changes:
        alert_col = "alert_on_petrol" if fuel_type == "petrol" else "alert_on_diesel"
        eligible = [t for t in tokens if getattr(t, alert_col) and abs(change_pct) >= (t.min_change_pct or 2.0)]
        if not eligible:
            continue

        already_sent_user_ids = {
            r.user_id for r in db.query(PriceAlert).filter(
                PriceAlert.fuel_type == fuel_type,
                PriceAlert.new_price == new_price,
            ).all()
        }

        unsent = [t for t in eligible if t.user_id not in already_sent_user_ids]
        if not unsent:
            continue

        title = f"🚗 Fuel Price Alert"
        body = (
            f"{fuel_type.capitalize()} {direction} {abs(change_pct):.1f}% "
            f"(Rs {old_price:.2f} → Rs {new_price:.2f}/L)"
        )

        messages = [
            {"to": t.token, "title": title, "body": body, "sound": "default", "data": {"fuel_type": fuel_type}}
            for t in unsent
        ]
        if messages:
            try:
                httpx.post(EXPO_PUSH_URL, json=messages, timeout=10)
            except Exception:
                pass

        for t in unsent:
            db.add(PriceAlert(user_id=t.user_id, fuel_type=fuel_type, old_price=old_price, new_price=new_price, change_pct=change_pct))
    db.commit()


def _ensure_prices_scraped(db: Session):
    global _last_stc_scrape
    if _last_stc_scrape and datetime.now() - _last_stc_scrape < _SCRAPE_COOLDOWN:
        logger.debug("STC scrape skipped — last attempt was less than 1 hour ago")
        return

    last = db.query(FuelPrice).order_by(FuelPrice.date.desc()).first()
    if last and last.date >= date_lib.today() - timedelta(days=7):
        return

    old_petrol = _get_oldest_new_price(db, "petrol")
    old_diesel = _get_oldest_new_price(db, "diesel")

    _last_stc_scrape = datetime.now()
    logger.info("Dashboard: prices stale, scraping STC…")
    fresh = fetch_retail_prices()
    if not fresh:
        logger.warning("Dashboard: STC scrape returned no data")
        return
    stored = 0
    for entry in fresh:
        d = entry["date"].date() if hasattr(entry["date"], 'date') else entry["date"]
        exists_petrol = db.query(FuelPrice).filter(
            FuelPrice.date == d, FuelPrice.fuel_type == "petrol"
        ).first()
        exists_diesel = db.query(FuelPrice).filter(
            FuelPrice.date == d, FuelPrice.fuel_type == "diesel"
        ).first()
        if not exists_petrol:
            db.add(FuelPrice(date=d, fuel_type="petrol", price=entry["petrol"]))
            stored += 1
        if not exists_diesel:
            db.add(FuelPrice(date=d, fuel_type="diesel", price=entry["diesel"]))
            stored += 1
    db.commit()
    logger.info(f"Dashboard: stored {stored} new price records")

    if stored > 0:
        _send_price_alerts(db, old_petrol, old_diesel)


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
        "fuel_type": user.fuel_type,
        "avatar_url": user.avatar_url,
        "user_name": user.full_name,
        "model": model_name,
        "evaluation": evaluation,
    }
