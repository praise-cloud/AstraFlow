import uuid
from sqlalchemy import Column, String, DateTime, Enum as SAEnum
from sqlalchemy.types import Uuid
from datetime import datetime, timezone

from backend.db.database import Base
import enum


class BusinessType(str, enum.Enum):
    RESTAURANT = "restaurant"
    TAXI = "taxi"
    DELIVERY = "delivery"
    RETAIL = "retail"
    LOGISTICS = "logistics"


class User(Base):
    __tablename__ = "users"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    business_type = Column(SAEnum(BusinessType, values_callable=lambda x: [e.value for e in x]), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))
