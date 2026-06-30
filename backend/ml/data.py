"""Data loading, cleaning, feature extraction for fuel price forecasting.

Pipeline stage 1: load historical data  (load_training_data_from_db / generate_training_data)
Pipeline stage 2: clean data           (clean_data)
Pipeline stage 3: feature extraction   (prepare_features)
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
from random import seed

import numpy as np
from sqlalchemy.orm import Session

from backend.db.database import SessionLocal
from backend.models.fuel_price import FuelPrice


# ---------------------------------------------------------------------------
# Stage 1 — Historical data loading
# ---------------------------------------------------------------------------

def load_training_data_from_db(days: int = 365, db: Optional[Session] = None) -> list[dict]:
    """Load real fuel price history from the database."""
    own_session = False
    if db is None:
        db = SessionLocal()
        own_session = True
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        records = (
            db.query(FuelPrice)
            .filter(FuelPrice.date >= cutoff)
            .order_by(FuelPrice.date.asc())
            .all()
        )
        if not records:
            return []

        by_date: dict[str, dict] = {}
        for r in records:
            key = str(r.date)
            if key not in by_date:
                dt = datetime.combine(r.date, datetime.min.time()).replace(tzinfo=timezone.utc)
                by_date[key] = {
                    "date": key,
                    "timestamp": dt.timestamp(),
                    "petrol": None,
                    "diesel": None,
                }
            fuel_attr = r.fuel_type.lower()
            if fuel_attr in ("petrol", "diesel"):
                by_date[key][fuel_attr] = float(r.price)

        result = [
            v for v in by_date.values()
            if v["petrol"] is not None or v["diesel"] is not None
        ]
        return result
    finally:
        if own_session:
            db.close()


def generate_training_data(days: int = 365, seed_val: int = 42) -> list[dict]:
    """Fallback: generate synthetic training data when real data is unavailable."""
    seed(seed_val)
    rng = np.random.default_rng(seed_val)

    base_petrol = 1.58
    base_diesel = 1.72
    history = []

    for i in range(days):
        date = datetime.now(timezone.utc) - timedelta(days=days - 1 - i)
        trend = np.sin(i / 90 * np.pi) * 0.08
        noise = rng.normal(0, 0.02)
        weekly = np.sin(i / 7 * np.pi) * 0.01

        petrol = round(base_petrol + trend + weekly + noise, 3)
        diesel = round(base_diesel + trend * 1.1 + weekly * 1.2 + rng.normal(0, 0.025), 3)

        history.append({
            "date": date.strftime("%Y-%m-%d"),
            "timestamp": date.timestamp(),
            "petrol": petrol,
            "diesel": diesel,
        })

    return history


# ---------------------------------------------------------------------------
# Stage 2 — Data cleaning
# ---------------------------------------------------------------------------

def clean_data(data: list[dict], fuel_type: str = "petrol") -> list[dict]:
    """Clean and validate historical price data.

    1. Sort chronologically
    2. Remove entries where the target fuel_type is None
    3. Remove outliers via IQR
    4. Forward-fill missing dates within the range
    """
    if not data:
        return []

    # 1. Sort
    sorted_data = sorted(data, key=lambda d: d["date"])

    # 2. Remove rows with no value for the target fuel
    filtered = [d for d in sorted_data if d.get(fuel_type) is not None]
    if not filtered:
        return []

    # 3. IQR outlier removal on the target fuel
    prices = np.array([d[fuel_type] for d in filtered])
    q1, q3 = np.percentile(prices, [25, 75])
    iqr = q3 - q1
    lower = q1 - 1.5 * iqr
    upper = q3 + 1.5 * iqr
    filtered = [d for d in filtered if lower <= d[fuel_type] <= upper]
    if not filtered:
        return []

    # 4. Forward-fill missing dates
    start = datetime.fromisoformat(filtered[0]["date"])
    end = datetime.fromisoformat(filtered[-1]["date"])
    date_map = {d["date"]: d for d in filtered}
    filled = []
    last_price = float(filtered[0][fuel_type])

    current = start
    while current <= end:
        key = current.strftime("%Y-%m-%d")
        if key in date_map:
            last_price = float(date_map[key][fuel_type])
            filled.append(date_map[key])
        else:
            filled.append({
                "date": key,
                "timestamp": current.replace(tzinfo=timezone.utc).timestamp(),
                "petrol": last_price if fuel_type == "petrol" else None,
                "diesel": last_price if fuel_type == "diesel" else None,
            })
        current += timedelta(days=1)

    return filled


# ---------------------------------------------------------------------------
# Stage 3 — Feature extraction
# ---------------------------------------------------------------------------

def prepare_features(history: list[dict], fuel_type: str = "petrol") -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Extract feature matrix X, target vector y, and timestamps from cleaned history.

    Features (6):
      0 — day_index       (linear day counter)
      1 — weekly_sin      (sin(2π * day / 7)) — weekly seasonality
      2 — weekly_cos      (cos(2π * day / 7)) — weekly seasonality
      3 — yearly_sin      (sin(2π * day / 365)) — yearly seasonality
      4 — momentum        (price[t] - price[t-1])  — 1-day lag diff
      5 — weekly_diff     (price[t] - price[t-7])  — 7-day lag diff
    """
    raw = np.array([d[fuel_type] for d in history], dtype=np.float64)
    n = len(raw)

    X = np.zeros((n, 6), dtype=np.float64)
    for i in range(n):
        X[i, 0] = i
        X[i, 1] = np.sin(2 * np.pi * i / 7)
        X[i, 2] = np.cos(2 * np.pi * i / 7)
        X[i, 3] = np.sin(2 * np.pi * i / 365)
        X[i, 4] = raw[i] - raw[i - 1] if i > 0 else 0.0
        X[i, 5] = raw[i] - raw[i - 7] if i >= 7 else 0.0

    return X, raw, np.array([d["timestamp"] for d in history])


def build_arima_series(data: list[dict], fuel_type: str = "petrol") -> np.ndarray:
    """Build a 1-D price series for ARIMA input (no engineered features)."""
    return np.array([d[fuel_type] for d in data], dtype=np.float64)
