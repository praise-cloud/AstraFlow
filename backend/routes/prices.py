import logging
from datetime import date as date_lib, datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.models.fuel_price import FuelPrice
from backend.routes.dashboard import get_current_user
from backend.models.user import User
from backend.services.scraper import fetch_retail_prices

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/prices", tags=["prices"])


def _ensure_prices_scraped(db: Session):
    """Auto-scrape STC if latest price is more than 7 days old."""
    last = db.query(FuelPrice).order_by(FuelPrice.date.desc()).first()
    if last and last.date >= date_lib.today() - timedelta(days=7):
        return
    logger.info("Prices stale, scraping STC…")
    fresh = fetch_retail_prices()
    if not fresh:
        logger.warning("STC scrape returned no data")
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
    logger.info(f"Stored {stored} new price records")


@router.get("/history")
def price_history(
    days: int = 90,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _ensure_prices_scraped(db)

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    all_records = (
        db.query(FuelPrice)
        .filter(FuelPrice.date >= cutoff)
        .order_by(FuelPrice.date.asc())
        .all()
    )

    if not all_records:
        return []

    by_date: dict[str, dict] = {}
    for r in all_records:
        key = str(r.date)
        if key not in by_date:
            by_date[key] = {"date": key, "label": r.date.strftime("%b %d"), "petrol": None, "diesel": None}
        if r.fuel_type == "petrol":
            by_date[key]["petrol"] = float(r.price)
        elif r.fuel_type == "diesel":
            by_date[key]["diesel"] = float(r.price)

    result = [v for v in by_date.values() if v["petrol"] is not None or v["diesel"] is not None]
    return result


class PriceAdminCreate(BaseModel):
    date: str
    fuel_type: str
    price: float


@router.post("/admin", status_code=201)
def admin_set_price(
    body: PriceAdminCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        dt = datetime.strptime(body.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid date format. Use YYYY-MM-DD")

    if body.fuel_type not in ("petrol", "diesel"):
        raise HTTPException(status_code=422, detail="fuel_type must be 'petrol' or 'diesel'")

    existing = (
        db.query(FuelPrice)
        .filter(FuelPrice.date == dt, FuelPrice.fuel_type == body.fuel_type)
        .first()
    )
    if existing:
        existing.price = body.price
    else:
        db.add(FuelPrice(date=dt, fuel_type=body.fuel_type, price=body.price))

    db.commit()
    return {"message": f"{body.fuel_type} price on {body.date} set to {body.price}"}
