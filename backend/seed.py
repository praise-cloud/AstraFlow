"""Seed the database with initial data."""
from datetime import date, timedelta
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

from backend.db.database import SessionLocal, init_db
from backend.models.fuel_price import FuelPrice
from backend.models.recommendation import Recommendation
from backend.models.user import BusinessType


FUEL_PRICES = [
    {"date": date(2026, 5, 25), "fuel_type": "mogas_95", "price": 1.64},
    {"date": date(2026, 5, 25), "fuel_type": "gas_oil", "price": 1.78},
    {"date": date(2026, 5, 26), "fuel_type": "mogas_95", "price": 1.63},
    {"date": date(2026, 5, 26), "fuel_type": "gas_oil", "price": 1.79},
    {"date": date(2026, 5, 27), "fuel_type": "mogas_95", "price": 1.62},
    {"date": date(2026, 5, 27), "fuel_type": "gas_oil", "price": 1.81},
    {"date": date(2026, 5, 28), "fuel_type": "mogas_95", "price": 1.61},
    {"date": date(2026, 5, 28), "fuel_type": "gas_oil", "price": 1.80},
    {"date": date(2026, 5, 29), "fuel_type": "mogas_95", "price": 1.62},
    {"date": date(2026, 5, 29), "fuel_type": "gas_oil", "price": 1.79},
    {"date": date(2026, 5, 30), "fuel_type": "mogas_95", "price": 1.63},
    {"date": date(2026, 5, 30), "fuel_type": "gas_oil", "price": 1.78},
    {"date": date(2026, 5, 31), "fuel_type": "mogas_95", "price": 1.64},
    {"date": date(2026, 5, 31), "fuel_type": "gas_oil", "price": 1.78},
]

RECOMMENDATIONS = [
    {
        "business_type": BusinessType.RESTAURANT,
        "content": "Fuel-related transport costs may increase next month. Review supplier contracts early and consider local sourcing to reduce delivery expenses.",
        "risk_level": "Moderate",
        "valid_from": date(2026, 6, 1),
        "valid_to": date(2026, 6, 30),
    },
    {
        "business_type": BusinessType.TAXI,
        "content": "Estimated fuel spending next month: Rs 12,000. Expected increase: Rs 1,500. Consider carpooling or shifting to off-peak hours to reduce costs.",
        "risk_level": "Moderate",
        "valid_from": date(2026, 6, 1),
        "valid_to": date(2026, 6, 30),
    },
    {
        "business_type": BusinessType.DELIVERY,
        "content": "Optimize delivery routes to reduce fuel consumption. Costs expected to rise 5-7%. Batch deliveries and avoid peak traffic hours.",
        "risk_level": "High",
        "valid_from": date(2026, 6, 1),
        "valid_to": date(2026, 6, 30),
    },
    {
        "business_type": BusinessType.RETAIL,
        "content": "Monitor supply chain fuel surcharges. Consider bulk ordering to lock in current rates before the projected price increase takes effect.",
        "risk_level": "Low",
        "valid_from": date(2026, 6, 1),
        "valid_to": date(2026, 6, 30),
    },
    {
        "business_type": BusinessType.LOGISTICS,
        "content": "Fuel costs projected to increase 8% next quarter. Evaluate fleet efficiency upgrades and renegotiate fuel surcharge agreements with clients.",
        "risk_level": "High",
        "valid_from": date(2026, 6, 1),
        "valid_to": date(2026, 6, 30),
    },
]


def seed():
    init_db()
    db = SessionLocal()

    existing = db.query(FuelPrice).first()
    if existing:
        print("Database already seeded. Skipping.")
        db.close()
        return

    for entry in FUEL_PRICES:
        db.add(FuelPrice(**entry))

    for rec in RECOMMENDATIONS:
        db.add(Recommendation(**rec))

    db.commit()
    db.close()
    print(f"Seeded {len(FUEL_PRICES)} fuel prices and {len(RECOMMENDATIONS)} recommendations.")


if __name__ == "__main__":
    seed()
