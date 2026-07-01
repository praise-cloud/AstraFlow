from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Date, DateTime

from backend.db.database import Base


class PredictionLog(Base):
    """Records every forecast point for later accuracy evaluation.

    When actual price data arrives via the scraper, the corresponding
    prediction records are \"resolved\" — the actual_price is filled in
    and the error is computed, enabling accuracy tracking over time.
    """

    __tablename__ = "prediction_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    model_type = Column(String(20), nullable=False, index=True)
    model_version = Column(Integer, nullable=True)
    forecast_date = Column(Date, nullable=False, index=True)
    predicted_price = Column(Float, nullable=False)
    actual_price = Column(Float, nullable=True)
    error = Column(Float, nullable=True)
    abs_error = Column(Float, nullable=True)
    pct_error = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))
    resolved_at = Column(DateTime(timezone=True), nullable=True)
