from sqlalchemy import Column, Integer, String, DateTime, Float, Uuid
from datetime import datetime, timezone

from backend.db.database import Base


class PriceAlert(Base):
    __tablename__ = "price_alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Uuid(as_uuid=True), nullable=False, index=True)
    fuel_type = Column(String(20), nullable=False)
    old_price = Column(Float, nullable=False)
    new_price = Column(Float, nullable=False)
    change_pct = Column(Float, nullable=False)
    sent_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))
