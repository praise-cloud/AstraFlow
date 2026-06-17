from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone

from backend.db.database import get_db
from backend.models.fuel_price import FuelPrice
from backend.routes.dashboard import get_current_user
from backend.models.user import User

router = APIRouter(prefix="/api/prices", tags=["prices"])


def _generate_mock_history(days: int = 30):
    from random import uniform, seed
    seed(42)
    base_petrol, base_diesel = 1.64, 1.78
    history = []
    for i in range(days):
        date = (datetime.now(timezone.utc) - timedelta(days=days - 1 - i)).strftime("%Y-%m-%d")
        label = (datetime.now(timezone.utc) - timedelta(days=days - 1 - i)).strftime("%b %d")
        petrol = round(base_petrol + uniform(-0.05, 0.05) + (i / days) * 0.03, 3)
        diesel = round(base_diesel + uniform(-0.05, 0.05) + (i / days) * 0.04, 3)
        history.append({"date": date, "label": label, "petrol": petrol, "diesel": diesel})
    return history


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

    if all_records:
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
        if result:
            return result

    return _generate_mock_history(days)
