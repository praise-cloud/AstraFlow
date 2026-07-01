"""Model accuracy tracking and evaluation.

Logs every forecast point to ``prediction_logs``, resolves predictions when
actual price data arrives, and generates accuracy reports.
"""

import logging
from datetime import datetime, timezone, date as date_lib, timedelta
from typing import Optional

import numpy as np

from backend.db.database import SessionLocal
from backend.models.prediction_log import PredictionLog
from backend.models.fuel_price import FuelPrice

logger = logging.getLogger("astraflow.evaluator")


def log_prediction(
    model_type: str,
    model_version: Optional[int],
    forecast_date: str,
    predicted_price: float,
) -> int:
    """Record a single forecast point in the prediction_logs table.

    Returns the ID of the new record.
    """
    db = SessionLocal()
    try:
        existing = (
            db.query(PredictionLog)
            .filter_by(
                model_type=model_type,
                forecast_date=date_lib.fromisoformat(forecast_date),
            )
            .first()
        )
        if existing:
            return existing.id

        log = PredictionLog(
            model_type=model_type,
            model_version=model_version,
            forecast_date=date_lib.fromisoformat(forecast_date),
            predicted_price=round(predicted_price, 3),
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log.id
    except Exception:
        logger.exception("Failed to log prediction for %s on %s", model_type, forecast_date)
        db.rollback()
        return -1
    finally:
        db.close()


def resolve_predictions() -> int:
    """Back-fill actual prices for past predictions where data now exists.

    Queries the ``fuel_prices`` table for dates that have prediction logs
    without an actual_price, then fills in the actual and computes errors.

    Returns the number of predictions resolved.
    """
    db = SessionLocal()
    try:
        unresolved = (
            db.query(PredictionLog)
            .filter(PredictionLog.actual_price.is_(None))
            .all()
        )
        if not unresolved:
            return 0

        resolved_count = 0
        now = datetime.now(timezone.utc)

        for pred in unresolved:
            actual_record = (
                db.query(FuelPrice)
                .filter(
                    FuelPrice.fuel_type == pred.model_type,
                    FuelPrice.date == pred.forecast_date,
                )
                .first()
            )
            if actual_record is None:
                continue

            actual = float(actual_record.price)
            pred.actual_price = actual
            pred.error = round(pred.predicted_price - actual, 4)
            pred.abs_error = round(abs(pred.error), 4)
            pred.pct_error = round((pred.error / actual) * 100, 2) if actual != 0 else None
            pred.resolved_at = now
            resolved_count += 1

        if resolved_count:
            db.commit()
            logger.info("Resolved %d prediction records", resolved_count)

        return resolved_count
    except Exception:
        logger.exception("Failed to resolve predictions")
        db.rollback()
        return 0
    finally:
        db.close()


def get_accuracy_report(
    model_type: str = "petrol",
    days: int = 30,
) -> dict:
    """Generate an accuracy report for a given model type over a window.

    Returns metrics including MAE, RMSE, MAPE, bias, and coverage ratio
    (fraction of predictions that have been resolved).
    """
    db = SessionLocal()
    try:
        cutoff = date_lib.today() - timedelta(days=days)

        predictions = (
            db.query(PredictionLog)
            .filter(
                PredictionLog.model_type == model_type,
                PredictionLog.forecast_date >= cutoff,
                PredictionLog.actual_price.isnot(None),
            )
            .all()
        )

        total = (
            db.query(PredictionLog)
            .filter(
                PredictionLog.model_type == model_type,
                PredictionLog.forecast_date >= cutoff,
            )
            .count()
        )

        if not predictions:
            return {
                "model_type": model_type,
                "days": days,
                "resolved": 0,
                "total": total,
                "coverage_pct": 0.0,
                "mae": None,
                "rmse": None,
                "mape": None,
                "bias": None,
                "within_5pct": None,
            }

        errors = np.array([p.error for p in predictions])
        abs_errors = np.array([p.abs_error for p in predictions])
        pct_errors = np.array([p.pct_error for p in predictions if p.pct_error is not None])

        mae = float(np.mean(abs_errors))
        rmse = float(np.sqrt(np.mean(errors ** 2)))
        mape = float(np.mean(np.abs(pct_errors))) if len(pct_errors) > 0 else None
        bias = float(np.mean(errors))
        within_5pct = float(np.mean(np.abs(pct_errors) <= 5)) * 100 if len(pct_errors) > 0 else None

        return {
            "model_type": model_type,
            "days": days,
            "resolved": len(predictions),
            "total": total,
            "coverage_pct": round(len(predictions) / max(total, 1) * 100, 1),
            "mae": round(mae, 4),
            "rmse": round(rmse, 4),
            "mape": round(mape, 2) if mape is not None else None,
            "bias": round(bias, 4),
            "within_5pct": round(within_5pct, 1) if within_5pct is not None else None,
        }
    except Exception:
        logger.exception("Failed to generate accuracy report for %s", model_type)
        return {"model_type": model_type, "error": "Failed to generate report"}
    finally:
        db.close()


def log_forecast_predictions(
    points: list[dict],
    fuel_type: str,
    model_version: Optional[int],
) -> int:
    """Log all forecast points from a forecast result.

    Returns the number of predictions logged.
    """
    count = 0
    for point in points:
        log_prediction(
            model_type=fuel_type,
            model_version=model_version,
            forecast_date=point["date"],
            predicted_price=point["predicted"],
        )
        count += 1
    return count
