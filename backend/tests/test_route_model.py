"""Tests for the RouteCostPredictor and route_optimizer hybrid scoring."""
import pytest
import numpy as np

from backend.db.database import init_db
from backend.models.model_registry import ModelRegistry
from backend.models.route_log import RouteLog
from backend.ml.route_model import RouteCostPredictor, _FEATURE_NAMES
from backend.ml.model_manager import ModelManager
from backend.services.route_optimizer import score_route, _heuristic_score, _ml_score


@pytest.fixture(autouse=True)
def _setup():
    init_db()
    from backend.db.database import SessionLocal
    db = SessionLocal()
    try:
        db.query(ModelRegistry).filter(ModelRegistry.model_type == "route").delete()
        db.query(RouteLog).delete()
        db.commit()
    finally:
        db.close()


class TestFeatureNames:
    def test_feature_names_are_defined(self):
        assert len(_FEATURE_NAMES) == 6
        assert "distance_km" in _FEATURE_NAMES
        assert "fuel_price" in _FEATURE_NAMES


class TestRouteCostPredictor:
    def test_init_falls_back_gracefully(self):
        predictor = RouteCostPredictor()
        assert predictor._loaded is False
        assert predictor._model is None

    def test_predict_returns_none_when_not_loaded(self):
        predictor = RouteCostPredictor()
        result = predictor.predict_liters({"distance_km": 10, "duration_min": 15})
        assert result is None

    def test_predict_with_ci_returns_nones_when_not_loaded(self):
        predictor = RouteCostPredictor()
        p, l, u = predictor.predict_with_ci({"distance_km": 10, "duration_min": 15})
        assert p is None and l is None and u is None


class TestRouteOptimizerScoring:
    def test_heuristic_score_returns_dict(self):
        result = _heuristic_score(10, 15, 2, 1.60)
        assert "ai_score" in result
        assert "estimated_liters" in result
        assert result["score_source"] == "heuristic"
        assert 0 <= result["ai_score"] <= 100

    def test_heuristic_score_zero_distance(self):
        result = _heuristic_score(0, 0, 0, 1.60)
        assert result["estimated_liters"] == 0.0

    def test_score_route_falls_back_to_heuristic(self):
        result = score_route(10, 15, 2, 1.60)
        assert "ai_score" in result
        assert "fuel_cost_usd" in result
        assert result.get("score_source") in ("heuristic", "ml")

    def test_score_route_no_traffic(self):
        result = score_route(10, 15, 0, 1.60)
        assert "ai_score" in result
        assert result["idle_fuel_cost"] == 0.0

    def test_score_route_high_distance(self):
        result = score_route(100, 90, 10, 1.60)
        assert result["ai_score"] >= 0
        assert result["estimated_liters"] > 0


class TestRouteLogModel:
    def test_create_route_log(self):
        from backend.db.database import SessionLocal
        db = SessionLocal()
        try:
            log = RouteLog(
                origin_lat=-20.15,
                origin_lng=57.48,
                dest_lat=-20.25,
                dest_lng=57.55,
                distance_km=15.5,
                duration_min=25.0,
                actual_liters=1.8,
            )
            db.add(log)
            db.commit()
            assert log.id is not None
            assert log.distance_km == 15.5
        finally:
            db.close()

    def test_route_log_defaults(self):
        from backend.db.database import SessionLocal
        db = SessionLocal()
        try:
            log = RouteLog(
                origin_lat=-20.15,
                origin_lng=57.48,
                dest_lat=-20.25,
                dest_lng=57.55,
                distance_km=10.0,
                duration_min=20.0,
                actual_liters=1.2,
            )
            db.add(log)
            db.commit()
            assert log.traffic_delay_min == 0.0
            assert log.created_at is not None
        finally:
            db.close()
