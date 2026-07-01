from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, Uuid, ForeignKey

from backend.db.database import Base


class RouteLog(Base):
    """Records actual route outcomes for training the route cost predictor."""

    __tablename__ = "route_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    origin_lat = Column(Float, nullable=False)
    origin_lng = Column(Float, nullable=False)
    dest_lat = Column(Float, nullable=False)
    dest_lng = Column(Float, nullable=False)
    distance_km = Column(Float, nullable=False)
    duration_min = Column(Float, nullable=False)
    traffic_delay_min = Column(Float, default=0.0)
    time_of_day = Column(Integer, nullable=True)
    day_of_week = Column(Integer, nullable=True)
    fuel_type = Column(String(20), nullable=True)
    fuel_price = Column(Float, nullable=True)
    predicted_liters = Column(Float, nullable=True)
    predicted_cost = Column(Float, nullable=True)
    actual_liters = Column(Float, nullable=True)
    actual_cost = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))
    completed_at = Column(DateTime(timezone=True), nullable=True)
