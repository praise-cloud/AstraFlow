from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone

from backend.db.database import get_db
from backend.models.fuel_price import FuelPrice
from backend.routes.dashboard import get_current_user
from backend.models.user import User

router = APIRouter(prefix="/api/prices", tags=["prices"])


@router.get("/history")
def price_history(
    days: int = 30,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    all_records = (
        db.query(FuelPrice)
        .filter(FuelPrice.date >= cutoff)
        .order_by(FuelPrice.date.asc())
        .all()
    )

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
