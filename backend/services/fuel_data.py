"""Fetch fuel price data from OpenVan.camp API for Mauritius."""
import json
import logging
import threading
import time
from datetime import date, datetime, timezone
from typing import Optional
from urllib.request import urlopen, Request

from backend.db.database import SessionLocal
from backend.models.fuel_price import FuelPrice
from backend.ml.forecast import get_forecaster
from backend.ml.data import load_training_data_from_db

logger = logging.getLogger(__name__)

API_URL = "https://openvan.camp/api/fuel/prices"
COUNTRY_CODE = "MU"
FETCH_INTERVAL_HOURS = 6
MIN_TRAINING_DAYS = 14

_last_fetch_time: Optional[datetime] = None
_last_fetch_error: Optional[str] = None


def fetch_live_prices() -> Optional[dict]:
    try:
        req = Request(API_URL, headers={"User-Agent": "AstraFlow/1.0 (Mauritius; +https://github.com/praise-cloud/AstraFlow)"})
        with urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
        country_data = data.get("data", {}).get(COUNTRY_CODE)
        if not country_data:
            logger.warning("Mauritius (MU) not found in OpenVan.camp response")
            return None
        prices = country_data.get("prices", {})
        return {
            "petrol": prices.get("gasoline"),
            "diesel": prices.get("diesel"),
            "currency": country_data.get("currency", "MUR"),
            "unit": country_data.get("unit", "liter"),
            "country_name": country_data.get("country_name", "Mauritius"),
        }
    except Exception as e:
        logger.error("Failed to fetch fuel prices: %s", e)
        return None


def store_prices(prices: dict) -> int:
    global _last_fetch_time, _last_fetch_error
    db = SessionLocal()
    try:
        today = date.today()
        stored = 0
        db.query(FuelPrice).filter(FuelPrice.date == today).delete()
        for fuel_type in ("petrol", "diesel"):
            val = prices.get(fuel_type)
            if val is not None:
                db.add(FuelPrice(date=today, fuel_type=fuel_type, price=round(val, 2)))
                stored += 1
        db.commit()
        _last_fetch_time = datetime.now(timezone.utc)
        _last_fetch_error = None
        logger.info("Stored %d fuel prices for %s", stored, today)
        return stored
    except Exception as e:
        db.rollback()
        logger.error("Failed to store fuel prices: %s", e)
        _last_fetch_error = str(e)
        return 0
    finally:
        db.close()


def retrain_forecaster():
    db = SessionLocal()
    try:
        data = load_training_data_from_db(365, db)
        if data and len(data) >= MIN_TRAINING_DAYS:
            forecaster = get_forecaster()
            forecaster.train(data)
            logger.info("Forecaster retrained with %d real data points", len(data))
    finally:
        db.close()


def fetch_and_store() -> bool:
    prices = fetch_live_prices()
    if prices is None:
        return False
    stored = store_prices(prices)
    if stored > 0:
        retrain_forecaster()
    return stored > 0


def get_last_fetch_info() -> dict:
    return {
        "last_fetch": _last_fetch_time.isoformat() if _last_fetch_time else None,
        "last_error": _last_fetch_error,
    }


_scheduler_thread: Optional[threading.Thread] = None
_stop_scheduler = False


def _scheduler_loop():
    logger.info("Fuel data scheduler: initial fetch")
    fetch_and_store()
    while not _stop_scheduler:
        for _ in range(FETCH_INTERVAL_HOURS * 60):
            if _stop_scheduler:
                return
            time.sleep(60)
        logger.info("Fuel data scheduler: periodic fetch")
        fetch_and_store()


def start_scheduler():
    global _scheduler_thread, _stop_scheduler
    if _scheduler_thread is not None and _scheduler_thread.is_alive():
        return
    _stop_scheduler = False
    _scheduler_thread = threading.Thread(target=_scheduler_loop, daemon=True)
    _scheduler_thread.start()
    logger.info("Fuel data scheduler started")


def stop_scheduler():
    global _stop_scheduler
    _stop_scheduler = True
    logger.info("Fuel data scheduler stopped")
