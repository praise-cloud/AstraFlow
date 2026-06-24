from sqlalchemy import Column, Integer, String, Text, DateTime, Date
from datetime import datetime, timezone

from backend.db.database import Base


class OilNews(Base):
    __tablename__ = "oil_news"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(300), nullable=False)
    summary = Column(String(500), nullable=False)
    content = Column(Text, nullable=False)
    source = Column(String(100), nullable=False)
    image_url = Column(String(500), nullable=True)
    published_at = Column(Date, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))
