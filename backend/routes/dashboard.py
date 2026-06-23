import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from backend.db.database import get_db
from backend.models.user import User, BusinessType
from backend.models.fuel_price import FuelPrice
from backend.models.survey import Survey
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
    user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def _compute_impact(change_pct: float) -> tuple[str, str]:
    if change_pct > 5:
        return ("High", "High")
    elif change_pct > 3:
        return ("High", "Moderate")
    elif change_pct > 1:
        return ("Medium", "Moderate")
    elif change_pct > -1:
        return ("Low", "Low")
    else:
        return ("Low", "Low")


BUSINESS_RECOMMENDATIONS = {
    BusinessType.RESTAURANT: {
        "title_up": "Prepare for Supply Cost Increases",
        "content_up": "Petrol prices are forecasted to rise {pct}% — restaurant supply chains will be affected. Review supplier contracts early and consider local sourcing.",
        "title_down": "Supply Costs May Ease",
        "content_down": "Falling fuel prices could reduce your supply chain costs by {pct}%. Renegotiate delivery contracts to capture savings.",
        "title_stable": "Market Steady — Stay Vigilant",
        "content_stable": "No significant fuel price movement expected. Use this window to lock in favorable supplier rates.",
    },
    BusinessType.TAXI: {
        "title_up": "Fuel Costs Rising — Plan Ahead",
        "content_up": "Petrol is projected to rise {pct}% over 30 days. Estimated extra cost: Rs {extra:.0f} at your current monthly spend of Rs {spend:.0f}. Consider carpooling or off-peak shifts.",
        "title_down": "Fuel Costs Dropping — Savings Ahead",
        "content_down": "Petrol prices expected to drop {pct}%. Estimated monthly saving: Rs {extra:.0f} at Rs {spend:.0f}/month spend.",
        "title_stable": "Fuel Prices Stable — Good Time to Drive",
        "content_stable": "No major price swings expected. Your estimated monthly cost remains around Rs {spend:.0f}.",
    },
    BusinessType.DELIVERY: {
        "title_up": "Delivery Margins Under Pressure",
        "content_up": "Fuel forecast shows a {pct}% increase. Optimize delivery routes and batch orders to reduce per-delivery fuel cost. Expected extra: Rs {extra:.0f}/month.",
        "title_down": "Delivery Costs Set to Decrease",
        "content_down": "Fuel prices dropping {pct}% — good news for margins. Estimated savings: Rs {extra:.0f}/month. Consider passing savings to customers.",
        "title_stable": "Delivery Costs Stable",
        "content_stable": "Fuel prices remain stable. Estimated monthly cost: Rs {spend:.0f}. Monitor for route optimization opportunities.",
    },
    BusinessType.RETAIL: {
        "title_up": "Supply Chain Surcharges Likely",
        "content_up": "Forecasted {pct}% fuel increase may trigger supplier surcharges. Consider bulk ordering to lock in current prices.",
        "title_down": "Retail Margins May Improve",
        "content_down": "Fuel costs dropping {pct}% — negotiate lower delivery fees with suppliers to improve margins.",
        "title_stable": "Retail Supply Costs Stable",
        "content_stable": "No fuel price volatility expected. Focus on operational efficiency while rates are predictable.",
    },
    BusinessType.LOGISTICS: {
        "title_up": "Fleet Fuel Costs Rising Significantly",
        "content_up": "Diesel is projected to increase {pct}% over 30 days. Evaluate fleet efficiency upgrades and renegotiate fuel surcharge agreements. Extra cost: Rs {extra:.0f}/month.",
        "title_down": "Logistics Costs Set to Decrease",
        "content_down": "Diesel forecasted to drop {pct}%. Estimated savings: Rs {extra:.0f}/month. Consider expanding delivery capacity.",
        "title_stable": "Logistics Fuel Costs Stable",
        "content_stable": "No significant diesel price movement. Use this period to audit fleet fuel efficiency.",
    },
}


def _get_default_fuel_type(biz_type: BusinessType) -> str:
    return "diesel" if biz_type in (BusinessType.LOGISTICS, BusinessType.DELIVERY) else "petrol"


@router.get("/dashboard")
def get_dashboard(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    biz_type = user.business_type
    fuel_type = _get_default_fuel_type(biz_type)

    latest = (
        db.query(FuelPrice)
        .filter(FuelPrice.date >= datetime.now(timezone.utc).date() - timedelta(days=7))
        .order_by(FuelPrice.date.desc())
        .all()
    )
    petrol_price = None
    diesel_price = None
    for r in latest:
        if r.fuel_type == "petrol" and petrol_price is None:
            petrol_price = float(r.price)
        elif r.fuel_type == "diesel" and diesel_price is None:
            diesel_price = float(r.price)
    if petrol_price is None:
        petrol_price = 63.28
    if diesel_price is None:
        diesel_price = 69.12

    forecaster = get_forecaster()
    forecast = forecaster.forecast(days=30, fuel_type=fuel_type)
    chg = forecast["change_pct"]

    impact_score, risk_level = _compute_impact(chg)

    user_survey = (
        db.query(Survey)
        .filter(Survey.user_id == user.id)
        .order_by(Survey.submitted_at.desc())
        .first()
    )
    monthly_spend = float(user_survey.monthly_fuel_spend) if user_survey and user_survey.monthly_fuel_spend else 10000.0

    extra_cost = abs(monthly_spend * chg / 100)
    rec_template = BUSINESS_RECOMMENDATIONS.get(biz_type, BUSINESS_RECOMMENDATIONS[BusinessType.RESTAURANT])

    if chg > 1:
        key = "up"
    elif chg < -1:
        key = "down"
    else:
        key = "stable"

    rec_title = rec_template[f"title_{key}"]
    rec_content = rec_template[f"content_{key}"].format(
        pct=abs(chg), extra=extra_cost, spend=monthly_spend,
    )

    seven_days_ago = datetime.now(timezone.utc).date() - timedelta(days=7)
    old_prices = (
        db.query(FuelPrice)
        .filter(FuelPrice.date >= seven_days_ago)
        .order_by(FuelPrice.date.asc())
        .all()
    )
    petrol_values = [float(r.price) for r in old_prices if r.fuel_type == "petrol"]
    diesel_values = [float(r.price) for r in old_prices if r.fuel_type == "diesel"]

    def calc_trend(values: list[float], current: float) -> tuple[str, float]:
        if not values or len(values) < 2:
            return ("stable", 0.0)
        first = values[0]
        change = current - first
        trend = "up" if change > 0.5 else "down" if change < -0.5 else "stable"
        return (trend, round(abs(change), 2))

    petrol_trend, petrol_chg = calc_trend(petrol_values, petrol_price)
    diesel_trend, diesel_chg = calc_trend(diesel_values, diesel_price)

    return {
        "current_price": {
            "petrol": petrol_price,
            "diesel": diesel_price,
            "currency": "MUR",
            "unit": "L",
        },
        "trend": {
            "petrol": petrol_trend,
            "petrol_change": petrol_chg,
            "diesel": diesel_trend,
            "diesel_change": diesel_chg,
        },
        "risk_level": risk_level,
        "impact_score": impact_score,
        "recommendation": {
            "title": rec_title,
            "content": rec_content,
        },
        "market_update": (
            f"Forecast: {fuel_type.title()} prices expected to move {forecast['trend']} by {abs(chg):.1f}% "
            f"over the next 30 days. Data sourced from OpenVan.camp."
        ),
        "business_type": biz_type.value,
        "user_name": user.full_name,
        "model": forecast.get("model", "local"),
        "evaluation": forecast.get("evaluation", {}),
    }
