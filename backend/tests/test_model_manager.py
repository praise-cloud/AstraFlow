"""Tests for ModelManager persistence layer."""
import json
import tempfile
from pathlib import Path

import pytest
import numpy as np

from backend.db.database import init_db
from backend.models.model_registry import ModelRegistry
from backend.ml import model_manager as _mm
from backend.ml.model_manager import ModelManager
from backend.ml.models import EnsembleForecaster, SKLearnWrapper


@pytest.fixture(autouse=True)
def _setup_db():
    init_db()
    from backend.db.database import SessionLocal
    db = SessionLocal()
    try:
        db.query(ModelRegistry).delete()
        db.commit()
    finally:
        db.close()


def _make_dummy_model() -> EnsembleForecaster:
    rng = np.random.default_rng(42)
    X = rng.random((30, 4))
    y = 2.0 * X[:, 0] + 1.5 * X[:, 1] + rng.normal(0, 0.05, 30)
    model = EnsembleForecaster()
    model.fit(X, y, y_raw=y)
    return model


class TestModelManagerSave:
    def test_save_returns_version(self):
        model = _make_dummy_model()
        version = ModelManager.save(model, "test_type", "test_model")
        assert version is not None
        assert version >= 1

    def test_save_increments_version(self):
        model = _make_dummy_model()
        v1 = ModelManager.save(model, "test_inc", "test_model")
        v2 = ModelManager.save(model, "test_inc", "test_model")
        assert v2 == v1 + 1

    def test_save_with_metrics(self):
        model = _make_dummy_model()
        metrics = {"mae": 0.02, "rmse": 0.03, "r2": 0.95}
        version = ModelManager.save(
            model, "test_metrics", "test_model",
            metrics=metrics, num_samples=30,
        )
        assert version is not None
        _, info = ModelManager.load_active("test_metrics", "test_model")
        assert info is not None
        assert info["metrics"] == metrics
        assert info["num_samples"] == 30

    def test_save_creates_joblib_file(self):
        model = _make_dummy_model()
        version = ModelManager.save(model, "test_file", "test_model")
        assert version is not None
        path = _mm._STORAGE_DIR / f"test_file_test_model_v{version}.joblib"
        assert path.exists()


class TestModelManagerLoad:
    def test_load_active_returns_none_when_empty(self):
        model, info = ModelManager.load_active("nonexistent", "test_model")
        assert model is None
        assert info is None

    def test_load_active_returns_saved_model(self):
        original = _make_dummy_model()
        ModelManager.save(original, "test_load", "test_model")
        loaded, info = ModelManager.load_active("test_load", "test_model")
        assert loaded is not None
        assert info is not None
        assert info["model_type"] == "test_load"
        assert info["version"] >= 1

    def test_loaded_model_can_predict(self):
        original = _make_dummy_model()
        ModelManager.save(original, "test_pred", "test_model")
        loaded, _ = ModelManager.load_active("test_pred", "test_model")
        rng = np.random.default_rng(99)
        X = rng.random((5, 4))
        preds = loaded.forecast_regression(X)
        assert preds.shape == (5,)
        assert np.all(np.isfinite(preds))

    def test_save_then_load_returns_latest_active(self):
        model = _make_dummy_model()
        ModelManager.save(model, "test_active", "test_model")
        ModelManager.save(model, "test_active", "test_model")
        ModelManager.save(model, "test_active", "test_model")
        _, info = ModelManager.load_active("test_active", "test_model")
        assert info["version"] == 3


class TestModelManagerList:
    def test_list_versions_returns_all(self):
        model = _make_dummy_model()
        ModelManager.save(model, "test_list", "test_model")
        ModelManager.save(model, "test_list", "test_model")
        versions = ModelManager.list_versions("test_list", "test_model")
        assert len(versions) == 2

    def test_list_versions_empty_when_none(self):
        versions = ModelManager.list_versions("nope", "test_model")
        assert versions == []


class TestModelManagerRollback:
    def test_rollback_changes_active(self):
        model = _make_dummy_model()
        ModelManager.save(model, "test_rb", "test_model")
        ModelManager.save(model, "test_rb", "test_model")
        ModelManager.save(model, "test_rb", "test_model")

        # Rollback to v1
        result = ModelManager.rollback("test_rb", 1)
        assert result is True

        _, info = ModelManager.load_active("test_rb", "test_model")
        assert info["version"] == 1

    def test_rollback_nonexistent_returns_false(self):
        result = ModelManager.rollback("test_rb_fail", 999)
        assert result is False


class TestModelManagerDeleteOld:
    def test_delete_old_keeps_last_n(self):
        model = _make_dummy_model()
        for _ in range(5):
            ModelManager.save(model, "test_prune", "test_model")

        deleted = ModelManager.delete_old_versions("test_prune", "test_model", keep_last=2)
        assert deleted == 3

        versions = ModelManager.list_versions("test_prune", "test_model")
        assert len(versions) == 2
