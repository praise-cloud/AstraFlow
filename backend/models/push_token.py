from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Float, Uuid
from datetime import datetime, timezone

from backend.db.database import Base


class PushToken(Base):
    __tablename__ = "push_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token = Column(String(255), nullable=False)
    platform = Column(String(10), default="expo")
    alerts_enabled = Column(Boolean, default=True)
    min_change_pct = Column(Float, default=2.0)
    alert_on_petrol = Column(Boolean, default=True)
    alert_on_diesel = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))
