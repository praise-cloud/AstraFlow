import logging
import os

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

logger = logging.getLogger("astraflow.database")

_DB_URL = os.getenv("DATABASE_URL", "")

if _DB_URL:
    try:
        engine = create_engine(_DB_URL, pool_pre_ping=True, pool_size=5, max_overflow=10)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        host = _DB_URL.split("@")[-1] if "@" in _DB_URL else _DB_URL[:40]
        logger.info("Connected to database at %s", host)
    except Exception as exc:
        logger.warning("Failed to connect to database at %s: %s", _DB_URL.split("@")[-1] if "@" in _DB_URL else _DB_URL[:40], exc)
        logger.warning("Falling back to local SQLite database at ./astraflow.db")
        _DB_URL = ""
        engine = create_engine("sqlite:///./astraflow.db", connect_args={"check_same_thread": False})
else:
    logger.info("No DATABASE_URL configured — using local SQLite database at ./astraflow.db")
    engine = create_engine("sqlite:///./astraflow.db", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
