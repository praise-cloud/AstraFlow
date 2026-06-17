from sqlalchemy import Column, Integer, Date, String, Numeric
from backend.db.database import Base


class FuelPrice(Base):
    __tablename__ = "fuel_prices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(Date, nullable=False, index=True)
    fuel_type = Column(String(20), nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
