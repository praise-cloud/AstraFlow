from datetime import datetime, timedelta, timezone
from typing import Optional
from random import uniform, seed

import numpy as np


def generate_training_data(days: int = 365, seed_val: int = 42) -> list[dict]:
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


def prepare_features(history: list[dict], fuel_type: str = "petrol") -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    raw = np.array([d[fuel_type] for d in history], dtype=np.float64)
    n = len(raw)

    X = np.zeros((n, 4), dtype=np.float64)
    for i in range(n):
        X[i, 0] = i
        X[i, 1] = np.sin(2 * np.pi * i / 7)
        X[i, 2] = np.cos(2 * np.pi * i / 7)
        X[i, 3] = np.sin(2 * np.pi * i / 365)

    return X, raw, np.array([d["timestamp"] for d in history])
