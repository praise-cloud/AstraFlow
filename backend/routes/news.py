from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy import inspect
from sqlalchemy.orm import Session

from backend.db.database import get_db, Base, engine
from backend.models.news import OilNews

router = APIRouter(prefix="/api/news", tags=["news"])

SEED_ARTICLES = [
    {
        "title": "Mauritius Fuel Prices Adjusted for June 2026",
        "summary": "The Mauritian authorities have announced a marginal increase in petrol and diesel prices effective this month, citing global crude oil volatility.",
        "content": "The Price Review Committee has approved a revised fuel pricing structure for June 2026. Petrol prices have increased by Rs 1.50 per litre, while diesel has seen a Rs 2.00 rise. The adjustments reflect ongoing fluctuations in global crude oil markets, driven by OPEC+ production decisions and geopolitical tensions. Industry analysts note that the increases remain within the expected annual range of 3-5% and advise businesses to incorporate fuel hedging strategies into their operational planning.",
        "source": "Mauritius Petroleum Commission",
        "published_at": date(2026, 6, 1),
    },
    {
        "title": "Global Crude Supply Concerns Impact Indian Ocean Markets",
        "summary": "Supply chain disruptions in the Red Sea corridor are contributing to higher import costs for Indian Ocean nations, including Mauritius.",
        "content": "Recent disruptions along key maritime routes have led to extended shipping times and elevated freight costs for crude oil shipments to the Indian Ocean region. For Mauritius, which imports nearly all of its refined petroleum products, these disruptions translate directly into higher retail prices. The Bank of Mauritius has indicated that fuel inflation could add 0.5 percentage points to the overall consumer price index if current trends persist. The government is exploring alternative supply agreements with Gulf State refineries to mitigate future price shocks.",
        "source": "Indian Ocean Energy Review",
        "published_at": date(2026, 5, 28),
    },
    {
        "title": "Electric Vehicle Adoption Accelerates in Mauritius",
        "summary": "The number of electric vehicles registered in Mauritius has doubled year-over-year, driven by government incentives and rising fuel costs.",
        "content": "Mauritius is experiencing a steady shift toward electric mobility, with EV registrations surpassing 4,000 units in the first quarter of 2026. The government's import duty exemptions on EV components and the expansion of public charging infrastructure have been key catalysts. The Central Electricity Board reports that the national grid has sufficient capacity to support the growing demand. However, stakeholders caution that the transition must be accompanied by workforce retraining programs for the automotive service sector, which remains heavily dependent on internal combustion engine maintenance.",
        "source": "Mauritius Clean Energy Agency",
        "published_at": date(2026, 5, 22),
    },
    {
        "title": "SMART Fuel Subsidy Programme Extended to December 2026",
        "summary": "The Mauritian government has extended its targeted fuel subsidy programme for small and medium enterprises for an additional six months.",
        "content": "The Ministry of Business has announced a six-month extension of the SMART Fuel Subsidy Programme, which provides qualifying SMEs with a 15% rebate on monthly fuel purchases. The programme, originally set to expire in June, has been renewed through December 2026 following a review that showed measurable relief for businesses in the transport and logistics sectors. Eligible businesses can apply through the Ministry's online portal. The extension is expected to benefit approximately 3,500 SMEs across Mauritius and Rodrigues.",
        "source": "Government of Mauritius Press Office",
        "published_at": date(2026, 5, 15),
    },
    {
        "title": "Mauritius Port Authority Expands Petroleum Storage Capacity",
        "summary": "A new petroleum storage terminal at Mer Rouge is set to increase the nation's strategic fuel reserves by 40%.",
        "content": "The Mauritius Port Authority has completed Phase I of the Mer Rouge Petroleum Storage Expansion Project, adding 60,000 metric tonnes of storage capacity for petrol, diesel, and jet fuel. The expanded facility enhances the island's energy security by providing a strategic buffer against global supply disruptions. Phase II, scheduled for completion in mid-2027, will add an additional 40,000 tonnes of capacity and include a new berth for larger tanker vessels. The project represents a total investment of MUR 3.2 billion.",
        "source": "Mauritius Port Authority",
        "published_at": date(2026, 5, 8),
    },
]


@router.get("")
def list_news(db: Session = Depends(get_db)):
    if not inspect(engine).has_table("oil_news"):
        Base.metadata.create_all(bind=engine)
    existing = db.query(OilNews).count()
    if existing == 0:
        for article in SEED_ARTICLES:
            db.add(OilNews(**article))
        db.commit()

    articles = db.query(OilNews).order_by(OilNews.published_at.desc()).all()
    return [
        {
            "id": a.id,
            "title": a.title,
            "summary": a.summary,
            "content": a.content,
            "source": a.source,
            "image_url": a.image_url,
            "published_at": a.published_at.isoformat(),
        }
        for a in articles
    ]
