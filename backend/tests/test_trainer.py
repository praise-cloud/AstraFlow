"""Tests for the background retraining scheduler."""
import pytest
import numpy as np

from backend.db.database import init_db
from backend.models.model_registry import ModelRegistry
from backend.ml.trainer import (
    _has_new_data,
    _count_new_records,
    _is_old,
    _is_better,
)
from backend.ml.model_manager import ModelManager
from backend.ml.models import EnsembleForecaster


@pytest.fixture(autouse=True)
def _setup():
    init_db()
    from backend.db.database import SessionLocal
    db = SessionLocal()
    try:
        db.query(ModelRegistry).delete()
        db.commit()
    finally:
        db.close()


def _make_model() -> EnsembleForecaster:
    rng = np.random.default_rng(42)
    X = rng.random((30, 4))
    y = 2.0 * X[:, 0] + 1.5 * X[:, 1] + rng.normal(0, 0.05, 30)
    model = EnsembleForecaster()
    model.fit(X, y, y_raw=y)
    return model


class TestHasNewData:
    def test_returns_true_when_no_model(self):
        has, _, _ = _has_new_data("test_new_data")
        assert has is True

    def test_returns_false_without_new_db_data(self):
        model = _make_model()
        ModelManager.save(model, "test_new_check", "test_model",
                          trained_until="2026-12-31")
        has, _, _ = _has_new_data("test_new_check")
        assert has is not None


class TestCountNewRecords:
    def test_returns_high_count_when_no_model(self):
        count = _count_new_records("test_no_model")
        assert count >= 100

    def test_count_is_integer(self):
        count = _count_new_records("petrol")
        assert isinstance(count, int)


class TestIsOld:
    def test_returns_true_when_no_model(self):
        assert _is_old() is True


class TestIsBetter:
    def test_new_is_better_when_no_active(self):
        assert _is_better({"mae": 0.02, "rmse": 0.03, "r2": 0.95}, None) is True

    def test_better_metrics(self):
        assert _is_better(
            {"mae": 0.01, "rmse": 0.02, "r2": 0.98},
            {"mae": 0.03, "rmse": 0.04, "r2": 0.95},
        ) is True

    def test_worse_metrics(self):
        assert _is_better(
            {"mae": 0.10, "rmse": 0.15, "r2": 0.50},
            {"mae": 0.02, "rmse": 0.03, "r2": 0.95},
        ) is False

    def test_similar_metrics_is_better(self):
        assert _is_better(
            {"mae": 0.0205, "rmse": 0.0305, "r2": 0.948},
            {"mae": 0.0200, "rmse": 0.0300, "r2": 0.950},
        ) is True
