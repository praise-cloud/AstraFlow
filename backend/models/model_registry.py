from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, Text

from backend.db.database import Base


class ModelRegistry(Base):
    __tablename__ = "model_registry"

    id = Column(Integer, primary_key=True, autoincrement=True)
    model_type = Column(String(20), nullable=False, index=True)
    model_name = Column(String(50), nullable=False)
    version = Column(Integer, nullable=False)
    is_active = Column(Boolean, default=False)
    trained_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))
    trained_until = Column(Date, nullable=True)
    num_samples = Column(Integer, nullable=True)
    metrics = Column(Text, nullable=True)
    serialized_path = Column(String(512), nullable=True)
    feature_names = Column(Text, nullable=True)
    extra_metadata = Column("metadata", Text, nullable=True)
