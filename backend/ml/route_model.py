"""ML model for predicting actual route fuel consumption.

Replaces the deterministic heuristic in ``route_optimizer.py`` with a
data-driven regressor trained on actual completed route outcomes.
"""

import json
import logging
from datetime import datetime
from typing import Optional, Any

import numpy as np

from backend.ml.model_manager import ModelManager
from backend.models.route_log import RouteLog

logger = logging.getLogger("astraflow.route_model")

_FEATURE_NAMES = [
    "distance_km", "duration_min", "traffic_delay_min",
    "time_of_day", "day_of_week", "fuel_price",
]

try:
    from sklearn.ensemble import GradientBoostingRegressor
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False
    logger.warning("sklearn not available — route ML disabled, using heuristic fallback")


class RouteCostPredictor:
    """Predicts actual fuel consumption (liters) for a route.

    Uses ``GradientBoostingRegressor`` trained on actual completed routes
    logged in the ``route_logs`` table.  When insufficient training data
    exists, falls back to the deterministic heuristic.
    """

    def __init__(self):
        self._model: Optional[Any] = None
        self._loaded = False
        self._try_load()

    def _try_load(self) -> None:
        loaded_model, info = ModelManager.load_active("route", "route_cost_predictor")
        if loaded_model is not None:
            self._model = loaded_model
            self._loaded = True
            logger.info("Loaded persisted route model v%d", info["version"])
        else:
            logger.info("No persisted route model found — will use heuristic fallback")

    # ------------------------------------------------------------------
    # Prediction
    # ------------------------------------------------------------------

    def predict_liters(self, features: dict) -> Optional[float]:
        """Predict fuel consumption in liters for a given route.

        Accepts a dict with keys matching ``_FEATURE_NAMES``.
        Returns ``None`` if the model is unavailable (fallback to heuristic).
        """
        if not self._loaded or self._model is None:
            return None

        try:
            X = self._features_to_array(features)
            pred = self._model.predict(X.reshape(1, -1))[0]
            return max(float(pred), 0.0)
        except Exception:
            logger.exception("Route prediction failed")
            return None

    def predict_with_ci(self, features: dict) -> tuple[Optional[float], Optional[float], Optional[float]]:
        """Return ``(prediction, lower_bound, upper_bound)`` or all ``None``."""
        if not self._loaded or self._model is None:
            return None, None, None

        try:
            X = self._features_to_array(features).reshape(1, -1)
            preds = []
            for estimator in self._model.estimators_:
                preds.append(estimator.predict(X)[0])
            pred = float(np.mean(preds))
            std = float(np.std(preds)) if len(preds) > 1 else 0.0
            lower = max(pred - 1.96 * std, 0.0)
            upper = pred + 1.96 * std
            return pred, lower, upper
        except Exception:
            logger.exception("Route CI prediction failed")
            return None, None, None

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------

    def train(self, db_session=None) -> bool:
        """Train the model on all completed route logs with actual_liters.

        Returns ``True`` if a model was trained and saved.
        """
        if not HAS_SKLEARN:
            logger.warning("Cannot train route model — sklearn not installed")
            return False

        from backend.db.database import SessionLocal
        own_session = False
        if db_session is None:
            db_session = SessionLocal()
            own_session = True

        try:
            logs = (
                db_session.query(RouteLog)
                .filter(RouteLog.actual_liters.isnot(None))
                .all()
            )
            if len(logs) < 10:
                logger.info("Insufficient route logs for training (%d < 10)", len(logs))
                return False

            X_list, y_list = [], []
            for log in logs:
                feats = {
                    "distance_km": log.distance_km,
                    "duration_min": log.duration_min,
                    "traffic_delay_min": log.traffic_delay_min or 0.0,
                    "time_of_day": log.time_of_day or 12,
                    "day_of_week": log.day_of_week or 0,
                    "fuel_price": log.fuel_price or 1.60,
                }
                X_list.append(self._features_to_array(feats))
                y_list.append(float(log.actual_liters))

            X = np.array(X_list)
            y = np.array(y_list)

            model = GradientBoostingRegressor(
                n_estimators=100, max_depth=4,
                learning_rate=0.1, random_state=42,
            )
            model.fit(X, y)

            train_preds = model.predict(X)
            residuals = y - train_preds
            mae = float(np.mean(np.abs(residuals)))
            rmse = float(np.sqrt(np.mean(residuals ** 2)))
            ss_res = np.sum(residuals ** 2)
            ss_tot = np.sum((y - np.mean(y)) ** 2)
            r2 = float(1 - ss_res / ss_tot) if ss_tot > 0 else 0.0

            metrics = {"mae": round(mae, 4), "rmse": round(rmse, 4), "r2": round(r2, 4)}

            version = ModelManager.save(
                model, "route", "route_cost_predictor",
                metrics=metrics,
                num_samples=len(logs),
                feature_names=_FEATURE_NAMES,
                extra_metadata={"source": "route_logs_training"},
            )
            ModelManager.delete_old_versions("route", "route_cost_predictor")

            if version:
                self._model = model
                self._loaded = True
                logger.info("Trained and saved route model v%d (%d samples, %s)", version, len(logs), metrics)
                return True

            return False

        except Exception:
            logger.exception("Route model training failed")
            return False
        finally:
            if own_session:
                db_session.close()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _features_to_array(features: dict) -> np.ndarray:
        return np.array([features.get(name, 0.0) for name in _FEATURE_NAMES], dtype=np.float64)


# ------------------------------------------------------------------
# Singleton accessor
# ------------------------------------------------------------------

_route_predictor_instance: Optional[RouteCostPredictor] = None


def get_route_predictor() -> RouteCostPredictor:
    global _route_predictor_instance
    if _route_predictor_instance is None:
        _route_predictor_instance = RouteCostPredictor()
    return _route_predictor_instance
