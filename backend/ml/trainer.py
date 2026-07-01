"""Background retraining scheduler with metric comparison.

The trainer decides WHEN to retrain, executes TRAINING, and handles version
deployment by comparing new model metrics against the currently active model.
"""

import logging
import threading
from datetime import datetime, timezone, timedelta
from typing import Optional

import numpy as np

from backend.ml.forecast import get_forecaster, FuelForecaster
from backend.ml.model_manager import ModelManager
from backend.ml.data import load_training_data_from_db, clean_data, prepare_features, build_arima_series
from backend.ml.models import EnsembleForecaster

logger = logging.getLogger("astraflow.trainer")

_MIN_NEW_RECORDS = 3
_MAX_AGE_HOURS = 24
_VALIDATION_SPLIT = 0.2


def _has_new_data(model_type: str = "petrol") -> tuple[bool, Optional[str], Optional[str]]:
    """Check if training data has advanced past the active model's training horizon.

    Returns ``(has_new, latest_db_date, trained_until)``.
    """
    _, info = ModelManager.load_active(model_type)
    if info is None:
        return True, None, None

    trained_until = info.get("trained_until")
    latest_db = load_training_data_from_db(30)
    if not latest_db:
        return False, trained_until, trained_until

    latest_db_date = max(d["date"] for d in latest_db)

    if trained_until is None:
        return True, latest_db_date, trained_until

    return latest_db_date > trained_until, latest_db_date, trained_until


def _count_new_records(fuel_type: str = "petrol") -> int:
    """Count how many price records exist beyond the active model's trained_until."""
    _, info = ModelManager.load_active(fuel_type)
    if info is None:
        return 999

    trained_until = info.get("trained_until")
    if trained_until is None:
        return 999

    data = load_training_data_from_db(365)
    if not data:
        return 0

    cleaned = clean_data(data, fuel_type)
    count = sum(1 for d in cleaned if d["date"] > trained_until)
    return count


def _is_old() -> bool:
    """Check if the active model was trained more than ``_MAX_AGE_HOURS`` ago."""
    _, info = ModelManager.load_active("petrol")
    if info is None:
        return True

    trained_at = info.get("trained_at")
    if trained_at is None:
        return True

    now = datetime.now(timezone.utc)
    try:
        trained_dt = datetime.fromisoformat(trained_at)
        return (now - trained_dt) > timedelta(hours=_MAX_AGE_HOURS)
    except (ValueError, TypeError):
        return True


def _validate_model(model: EnsembleForecaster, fuel_type: str) -> Optional[dict]:
    """Evaluate a model on held-out validation data and return metrics.

    Returns ``None`` if there is insufficient data for validation.
    """
    data = load_training_data_from_db(365)
    if not data:
        return None

    cleaned = clean_data(data, fuel_type)
    X, y, _ = prepare_features(cleaned, fuel_type)

    n = len(X)
    split = int(n * (1 - _VALIDATION_SPLIT))
    if split < 10 or n - split < 5:
        return None

    X_train, y_train = X[:split], y[:split]
    X_val, y_val = X[split:], y[split:]

    y_raw = build_arima_series(cleaned, fuel_type)
    val_model = EnsembleForecaster()
    val_model.fit(X_train, y_train, y_raw=y_raw[:split])

    val_preds = val_model.forecast_regression(X_val)
    residuals = y_val - val_preds

    mae = float(np.mean(np.abs(residuals)))
    rmse = float(np.sqrt(np.mean(residuals ** 2)))
    ss_res = np.sum(residuals ** 2)
    ss_tot = np.sum((y_val - np.mean(y_val)) ** 2)
    r2 = float(1 - ss_res / ss_tot) if ss_tot > 0 else 0.0

    return {"mae": round(mae, 4), "rmse": round(rmse, 4), "r2": round(r2, 4)}


def _is_better(new_metrics: dict, active_metrics: Optional[dict]) -> bool:
    """Compare validation metrics of a new model against the active model.

    Returns ``True`` if the new model is better (lower MAE/RMSE, higher R²).
    If no active model exists, the new model is always considered better.
    """
    if active_metrics is None:
        return True

    new_mae = new_metrics.get("mae", 999)
    active_mae = active_metrics.get("mae", 999)

    new_rmse = new_metrics.get("rmse", 999)
    active_rmse = active_metrics.get("rmse", 999)

    new_r2 = new_metrics.get("r2", -999)
    active_r2 = active_metrics.get("r2", -999)

    mae_improvement = (active_mae - new_mae) / max(active_mae, 0.001) * 100
    rmse_improvement = (active_rmse - new_rmse) / max(active_rmse, 0.001) * 100
    r2_improvement = new_r2 - active_r2

    score = mae_improvement + rmse_improvement + (r2_improvement * 100)
    return score > -5


def retrain_in_background() -> None:
    """Retrain both petrol and diesel models in a background thread.

    After retraining, validates the new model and only saves it if its
    performance is comparable to or better than the currently active model.
    """
    thread = threading.Thread(target=_retrain_both, daemon=True)
    thread.start()
    logger.info("Background retrain thread started")


def _retrain_both() -> None:
    """Retrain both fuel type models, validate, and conditionally save."""
    data = load_training_data_from_db(365)
    if not data or len(data) < 14:
        logger.info("Insufficient data for retraining")
        return

    fc = get_forecaster()

    for fuel_type in ("petrol", "diesel"):
        try:
            _retrain_single(fc, data, fuel_type)
        except Exception:
            logger.exception("Failed to retrain %s model", fuel_type)


def _retrain_single(fc: FuelForecaster, data: list[dict], fuel_type: str) -> None:
    """Retrain a single fuel-type model and save if it passes validation."""
    cleaned = clean_data(data, fuel_type)
    if not cleaned:
        logger.warning("No cleaned data for %s, skipping retrain", fuel_type)
        return

    X, y, _ = prepare_features(cleaned, fuel_type)
    y_raw = build_arima_series(cleaned, fuel_type)

    new_model = EnsembleForecaster()
    new_model.fit(X, y, y_raw=y_raw)

    _, active_info = ModelManager.load_active(fuel_type)
    active_metrics = active_info.get("metrics") if active_info else None

    new_metrics = new_model.evaluate(X, y)

    val_metrics = _validate_model(new_model, fuel_type)
    should_deploy = True

    if val_metrics is not None:
        should_deploy = _is_better(val_metrics, active_metrics)
        if should_deploy:
            logger.info(
                "%s: new model validated (val_mae=%.4f, val_r2=%.4f), deploying",
                fuel_type, val_metrics["mae"], val_metrics["r2"],
            )
        else:
            logger.info(
                "%s: new model NOT better than active, skipping (val_mae=%.4f vs active=%.4f)",
                fuel_type, val_metrics["mae"],
                active_metrics.get("mae", "N/A") if active_metrics else "N/A",
            )

    if should_deploy:
        trained_until = cleaned[-1]["date"]
        num_samples = len(cleaned)
        feature_names = new_model._feature_names

        ModelManager.save(
            new_model, fuel_type,
            metrics=new_metrics,
            trained_until=trained_until,
            num_samples=num_samples,
            feature_names=feature_names,
            extra_metadata={"fuel_type": fuel_type, "source": "auto_retrain"},
        )
        ModelManager.delete_old_versions(fuel_type)

        _, fc._petrol_info = ModelManager.load_active("petrol") if fuel_type == "petrol" else (None, None)
        if fuel_type == "petrol":
            fc._petrol_model = new_model
            _, fc._petrol_info = ModelManager.load_active("petrol")
        else:
            fc._diesel_model = new_model
            _, fc._diesel_info = ModelManager.load_active("diesel")


def retrain_if_due() -> bool:
    """Check if retraining is due and start a background retrain if so.

    Called from the dashboard scraper or on startup.

    Returns ``True`` if a retrain was triggered.
    """
    has_new_p, _, _ = _has_new_data("petrol")
    has_new_d, _, _ = _has_new_data("diesel")

    if not has_new_p and not has_new_d and not _is_old():
        return False

    new_count_p = _count_new_records("petrol")
    new_count_d = _count_new_records("diesel")

    if new_count_p < _MIN_NEW_RECORDS and new_count_d < _MIN_NEW_RECORDS and not _is_old():
        return False

    retrain_in_background()
    return True
