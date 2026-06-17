from sqlalchemy import Column, Integer, String, Date, Enum as SAEnum
from backend.db.database import Base
from backend.models.user import BusinessType


class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    business_type = Column(SAEnum(BusinessType, values_callable=lambda x: [e.value for e in x]), nullable=False)
    content = Column(String(500), nullable=False)
    risk_level = Column(String(20), nullable=False)
    valid_from = Column(Date, nullable=False)
    valid_to = Column(Date, nullable=True)
