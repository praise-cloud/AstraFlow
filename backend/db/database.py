from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

_DB_URL = os.getenv("DATABASE_URL", "")
if _DB_URL and "supabase" in _DB_URL:
    try:
        engine = create_engine(_DB_URL, pool_pre_ping=True, pool_size=5, max_overflow=10)
        with engine.connect() as conn:
            pass
    except Exception:
        _DB_URL = ""
        engine = create_engine("sqlite:///./astraflow.db", connect_args={"check_same_thread": False})
else:
    engine = create_engine(_DB_URL or "sqlite:///./astraflow.db", connect_args={"check_same_thread": False})
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
