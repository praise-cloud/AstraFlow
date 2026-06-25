from sqlalchemy import Column, Integer, String, Numeric, DateTime, Enum as SAEnum, ForeignKey, Uuid, JSON
from datetime import datetime, timezone

from backend.db.database import Base
from backend.models.user import BusinessType


class Survey(Base):
    __tablename__ = "surveys"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)
    business_type = Column(SAEnum(BusinessType, values_callable=lambda x: [e.value for e in x]), nullable=False)
    monthly_fuel_spend = Column(Numeric(10, 2), nullable=True)
    impact_level = Column(String(20), nullable=True)
    concern_areas = Column(JSON, nullable=True)
    comments = Column(String(500), nullable=True)
    submitted_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))
