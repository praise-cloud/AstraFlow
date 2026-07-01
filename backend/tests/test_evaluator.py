"""Tests for the prediction logging and accuracy evaluation system."""
import pytest
from datetime import date, datetime, timezone

from backend.db.database import init_db
from backend.models.prediction_log import PredictionLog
from backend.models.fuel_price import FuelPrice
from backend.ml.evaluator import (
    log_prediction,
    resolve_predictions,
    get_accuracy_report,
    log_forecast_predictions,
)


@pytest.fixture(autouse=True)
def _setup():
    init_db()
    from backend.db.database import SessionLocal
    db = SessionLocal()
    try:
        db.query(PredictionLog).delete()
        db.query(FuelPrice).delete()
        db.commit()
    finally:
        db.close()


class TestLogPrediction:
    def test_logs_prediction_record(self):
        pid = log_prediction("petrol", 1, "2026-07-15", 1.65)
        assert pid > 0

    def test_deduplicates_same_date(self):
        pid1 = log_prediction("petrol", 1, "2026-07-15", 1.65)
        pid2 = log_prediction("petrol", 1, "2026-07-15", 1.66)
        assert pid1 == pid2

    def test_logs_different_dates(self):
        pid1 = log_prediction("petrol", 1, "2026-07-15", 1.65)
        pid2 = log_prediction("petrol", 1, "2026-07-16", 1.66)
        assert pid1 != pid2


class TestResolvePredictions:
    def test_resolves_prediction_with_actual_price(self):
        from backend.db.database import SessionLocal
        db = SessionLocal()
        try:
            log_prediction("petrol", 1, "2026-07-15", 1.65)
            db.add(FuelPrice(date=date(2026, 7, 15), fuel_type="petrol", price=1.68))
            db.commit()
        finally:
            db.close()

        resolved = resolve_predictions()
        assert resolved >= 1

        report = get_accuracy_report("petrol", days=365)
        assert report["resolved"] >= 1
        assert report["mae"] is not None

    def test_resolve_nonexistent_prediction(self):
        resolved = resolve_predictions()
        assert resolved == 0

    def test_computes_correct_error(self):
        from backend.db.database import SessionLocal
        db = SessionLocal()
        try:
            log_prediction("petrol", 1, "2026-07-20", 1.70)
            db.add(FuelPrice(date=date(2026, 7, 20), fuel_type="petrol", price=1.75))
            db.commit()
        finally:
            db.close()

        resolve_predictions()
        report = get_accuracy_report("petrol", days=365)
        assert report["resolved"] >= 1
        assert pytest.approx(report["bias"], abs=0.01) == -0.05


class TestAccuracyReport:
    def test_report_returns_expected_keys(self):
        report = get_accuracy_report("petrol", days=30)
        assert "mae" in report
        assert "rmse" in report
        assert "coverage_pct" in report
        assert "model_type" in report
        assert report["model_type"] == "petrol"

    def test_report_shows_no_data_when_empty(self):
        report = get_accuracy_report("petrol", days=30)
        assert report["mae"] is None

    def test_report_with_resolved_data(self):
        from backend.db.database import SessionLocal
        db = SessionLocal()
        try:
            log_prediction("petrol", 1, "2026-07-10", 1.60)
            log_prediction("petrol", 1, "2026-07-11", 1.62)
            db.add(FuelPrice(date=date(2026, 7, 10), fuel_type="petrol", price=1.61))
            db.add(FuelPrice(date=date(2026, 7, 11), fuel_type="petrol", price=1.63))
            db.commit()
        finally:
            db.close()

        resolve_predictions()
        report = get_accuracy_report("petrol", days=365)
        assert report["resolved"] == 2
        assert report["mae"] > 0
        assert report["total"] >= 2


class TestLogForecastPredictions:
    def test_logs_all_points(self):
        points = [
            {"date": "2026-08-01", "predicted": 1.65},
            {"date": "2026-08-02", "predicted": 1.66},
            {"date": "2026-08-03", "predicted": 1.67},
        ]
        count = log_forecast_predictions(points, "diesel", 2)
        assert count == 3

    def test_deduplicates_across_calls(self):
        points = [{"date": "2026-08-01", "predicted": 1.65}]
        log_forecast_predictions(points, "petrol", 1)
        count = log_forecast_predictions(points, "petrol", 1)
        assert count == 1  # Only 1 logged (duplicate skipped)
