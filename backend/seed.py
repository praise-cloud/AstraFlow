"""Seed the database with data scraped from the STC website."""
from datetime import date
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

from backend.db.database import SessionLocal, init_db
from backend.models.fuel_price import FuelPrice
from backend.models.news import OilNews
from backend.models.recommendation import Recommendation
from backend.models.user import BusinessType
from backend.services.scraper import fetch_retail_prices
from backend.services.news_scraper import fetch_news


def seed():
    init_db()
    db = SessionLocal()

    existing = db.query(FuelPrice).first()
    if existing:
        print("Database already has fuel price records. Skipping scrape and seed.")
    else:
        print("Fetching retail prices from STC website...")
        prices = fetch_retail_prices()
        if not prices:
            print("Warning: could not fetch prices from STC. Proceeding with existing data.")
        else:
            count = 0
            for p in prices:
                exists = (
                    db.query(FuelPrice)
                    .filter(FuelPrice.date == p["date"].date(), FuelPrice.fuel_type == "petrol")
                    .first()
                )
                if exists:
                    continue
                db.add(FuelPrice(date=p["date"].date(), fuel_type="petrol", price=p["petrol"]))
                db.add(FuelPrice(date=p["date"].date(), fuel_type="diesel", price=p["diesel"]))
                count += 1
            db.commit()
            print(f"Seeded {count} price dates ({count * 2} records) from STC website.")

    recommendations_exist = db.query(Recommendation).first()
    if not recommendations_exist:
        recs = [
            {
                "business_type": BusinessType.RESTAURANT,
                "content": "Fuel-related transport costs may increase next month. Review supplier contracts early and consider local sourcing to reduce delivery expenses.",
                "risk_level": "Moderate",
                "valid_from": date.today(),
                "valid_to": None,
            },
            {
                "business_type": BusinessType.TAXI,
                "content": "Estimated fuel spending next month: Rs 12,000. Expected increase: Rs 1,500. Consider carpooling or shifting to off-peak hours to reduce costs.",
                "risk_level": "Moderate",
                "valid_from": date.today(),
                "valid_to": None,
            },
            {
                "business_type": BusinessType.DELIVERY,
                "content": "Optimize delivery routes to reduce fuel consumption. Costs expected to rise 5-7%. Batch deliveries and avoid peak traffic hours.",
                "risk_level": "High",
                "valid_from": date.today(),
                "valid_to": None,
            },
            {
                "business_type": BusinessType.RETAIL,
                "content": "Monitor supply chain fuel surcharges. Consider bulk ordering to lock in current rates before the projected price increase takes effect.",
                "risk_level": "Low",
                "valid_from": date.today(),
                "valid_to": None,
            },
            {
                "business_type": BusinessType.LOGISTICS,
                "content": "Fuel costs projected to increase 8% next quarter. Evaluate fleet efficiency upgrades and renegotiate fuel surcharge agreements with clients.",
                "risk_level": "High",
                "valid_from": date.today(),
                "valid_to": None,
            },
        ]
        for rec in recs:
            db.add(Recommendation(**rec))
        db.commit()
        print(f"Seeded {len(recs)} recommendations.")
    else:
        print("Recommendations already exist. Skipping.")

    news_exist = db.query(OilNews).first()
    if not news_exist:
        print("Fetching news articles...")
        articles = fetch_news()
        for a in articles:
            db.add(OilNews(
                title=a["title"],
                summary=a["summary"],
                content=a["content"],
                source=a["source"],
                published_at=a["published_at"],
            ))
        db.commit()
        print(f"Seeded {len(articles)} news articles.")
    else:
        print("News articles already exist. Skipping.")

    db.close()
    print("Seed complete.")


if __name__ == "__main__":
    seed()
