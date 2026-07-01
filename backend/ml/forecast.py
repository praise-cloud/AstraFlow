"""Fuel price forecasting — pipeline orchestrator with model persistence.

Pipeline stages:
  1. Load historical data
  2. Clean data
  3. Extract features
  4. Train ensemble (Linear + RandomForest + ARIMA)
  5. Generate forecast

Continuous training + persistence:
  - On startup, the latest active model is loaded from disk via ModelManager.
  - On each forecast request, the DB is checked for new price records.
  - If new data exists, the model is retrained in the foreground and the new
    version is saved to the model registry.
  - This avoids retraining on every restart while keeping the model fresh.
"""

from datetime import datetime, timezone, timedelta
import logging
from typing import Optional

import numpy as np

from backend.ml.data import (
    load_training_data_from_db,
    generate_training_data,
    clean_data,
    prepare_features,
    build_arima_series,
)
from backend.ml.models import EnsembleForecaster
from backend.ml.model_manager import ModelManager
from backend.ml.evaluator import log_forecast_predictions

logger = logging.getLogger("astraflow.forecast")


class FuelForecaster:
    """High-level forecaster orchestrating the 5-stage pipeline.

    Usage
    -----
        fc = FuelForecaster()
        fc.train()                          # stages 1-4
        result = fc.forecast(days=30)       # stage 5
    """

    def __init__(self):
        self._petrol_model: EnsembleForecaster
        self._diesel_model: EnsembleForecaster
        self._petrol_info: Optional[dict] = None
        self._diesel_info: Optional[dict] = None
        self._trained = False

        self._try_load_persisted()

    # ------------------------------------------------------------------
    # Persistence helpers
    # ------------------------------------------------------------------

    def _try_load_persisted(self) -> None:
        """Attempt to load the latest saved models from disk.

        Falls back to training from DB if no saved model exists.
        """
        petrol_model, petrol_info = ModelManager.load_active("petrol")
        diesel_model, diesel_info = ModelManager.load_active("diesel")

        if petrol_model is not None:
            self._petrol_model = petrol_model
            self._petrol_info = petrol_info
            logger.info("Loaded persisted petrol model v%d", petrol_info["version"])
        else:
            self._petrol_model = EnsembleForecaster()

        if diesel_model is not None:
            self._diesel_model = diesel_model
            self._diesel_info = diesel_info
            logger.info("Loaded persisted diesel model v%d", diesel_info["version"])
        else:
            self._diesel_model = EnsembleForecaster()

        if petrol_model is not None and diesel_model is not None:
            self._trained = True

    # ------------------------------------------------------------------
    # Stage 1-2: Load + Clean
    # ------------------------------------------------------------------

    @staticmethod
    def _load_and_clean(history: Optional[list[dict]] = None) -> list[dict]:
        """Load raw data (stage 1) and clean it (stage 2)."""
        data = history
        if data is None:
            data = load_training_data_from_db(365)
        if not data or len(data) < 14:
            data = generate_training_data(365)
        return data

    # ------------------------------------------------------------------
    # Stage 4: Train
    # ------------------------------------------------------------------

    def train(self, history: Optional[list[dict]] = None) -> None:
        """Execute pipeline stages 1-4: load → clean → feature extract → train.

        After training, the models are saved to the model registry so they
        survive restarts.
        """
        raw = self._load_and_clean(history)

        cleaned_p = clean_data(raw, "petrol")
        cleaned_d = clean_data(raw, "diesel")

        X_p, y_p, _ = prepare_features(cleaned_p, "petrol")
        X_d, y_d, _ = prepare_features(cleaned_d, "diesel")

        y_p_raw = build_arima_series(cleaned_p, "petrol")
        y_d_raw = build_arima_series(cleaned_d, "diesel")

        self._petrol_model = EnsembleForecaster()
        self._petrol_model.fit(X_p, y_p, y_raw=y_p_raw)

        self._diesel_model = EnsembleForecaster()
        self._diesel_model.fit(X_d, y_d, y_raw=y_d_raw)

        self._trained = True

        trained_until = None
        num_samples = 0
        if cleaned_p:
            trained_until = cleaned_p[-1]["date"]
            num_samples = len(cleaned_p)

        # Persist both models
        eval_p = self._petrol_model.evaluate(X_p, y_p)
        eval_d = self._diesel_model.evaluate(X_d, y_d)

        feature_names = self._petrol_model._feature_names

        petrol_ver = ModelManager.save(
            self._petrol_model, "petrol",
            metrics=eval_p,
            trained_until=trained_until,
            num_samples=num_samples,
            feature_names=feature_names,
            extra_metadata={"fuel_type": "petrol"},
        )
        diesel_ver = ModelManager.save(
            self._diesel_model, "diesel",
            metrics=eval_d,
            trained_until=trained_until,
            num_samples=num_samples,
            feature_names=feature_names,
            extra_metadata={"fuel_type": "diesel"},
        )

        _, self._petrol_info = ModelManager.load_active("petrol") if petrol_ver else (None, None)
        _, self._diesel_info = ModelManager.load_active("diesel") if diesel_ver else (None, None)

        ModelManager.delete_old_versions("petrol")
        ModelManager.delete_old_versions("diesel")

    # ------------------------------------------------------------------
    # Continuous training
    # ------------------------------------------------------------------

    def _retrain_if_needed(self, force: bool = False) -> None:
        """Check DB for new price records and retrain if found.

        Uses the ``trained_until`` date stored in the model registry to
        determine whether fresh data is available.
        """
        if not self._trained:
            self.train()
            return

        if force:
            self.train()
            return

        trained_until = None
        if self._petrol_info and self._petrol_info.get("trained_until"):
            trained_until = self._petrol_info["trained_until"]

        latest_db = load_training_data_from_db(30)
        if not latest_db:
            return

        latest_db_date = max(d["date"] for d in latest_db)
        if trained_until is None or latest_db_date > trained_until:
            logger.info("New price data detected (%s > %s), retraining…", latest_db_date, trained_until)
            self.train()

    # ------------------------------------------------------------------
    # Stage 5: Forecast generation
    # ------------------------------------------------------------------

    def forecast(
        self,
        days: int = 30,
        fuel_type: str = "petrol",
        history: Optional[list[dict]] = None,
    ) -> dict:
        """Execute full pipeline and generate forecast.

        Steps:
          1. Retrain if new DB data exists (continuous learning)
          2. Load & clean data for feature construction
          3. Build future feature matrix
          4. Generate blended ensemble predictions + confidence intervals
          5. Compute evaluation metrics, trend, recommendation
          6. Return structured forecast result
        """
        self._retrain_if_needed()

        model = self._petrol_model if fuel_type == "petrol" else self._diesel_model

        raw = self._load_and_clean(history)
        cleaned = clean_data(raw, fuel_type)
        X_train, y_train, timestamps = prepare_features(cleaned, fuel_type)

        n_features = X_train.shape[1]
        n = len(X_train)
        X_future = np.zeros((days, n_features), dtype=np.float64)
        for i in range(days):
            idx = n + i
            X_future[i, 0] = idx
            X_future[i, 1] = np.sin(2 * np.pi * idx / 7)
            X_future[i, 2] = np.cos(2 * np.pi * idx / 7)
            X_future[i, 3] = np.sin(2 * np.pi * idx / 365)
            X_future[i, 4] = 0.0
            X_future[i, 5] = 0.0

        preds, lower, upper = model.predict_with_ci(X_future, y_train, X_hist=X_train)
        preds = np.maximum(preds, 0.5)

        current_price = float(y_train[-1]) if len(y_train) > 0 else 1.60
        today = datetime.now(timezone.utc)

        points = []
        for i in range(days):
            date = today + timedelta(days=i + 1)
            points.append({
                "date": date.strftime("%Y-%m-%d"),
                "label": date.strftime("%b %d"),
                "predicted": round(float(preds[i]), 3),
                "lower_bound": round(float(max(lower[i], 0.5)), 3),
                "upper_bound": round(float(upper[i]), 3),
            })

        avg_pred = float(np.mean(preds))
        pct_change = ((avg_pred - current_price) / current_price) * 100
        max_pred = float(np.max(preds))
        min_pred = float(np.min(preds))

        trend = "up" if pct_change > 1 else "down" if pct_change < -1 else "stable"

        evaluation = model.evaluate(X_train, y_train)
        feature_imp = model.feature_importance()
        recommendation = self._generate_recommendation(trend, pct_change, avg_pred, current_price)

        model_parts = ["Linear"]
        if model.rf.available:
            model_parts.append("RandomForest")
        if model.arima.available:
            model_parts.append("ARIMA")
        model_name = " + ".join(model_parts) + " Ensemble"

        info = self._petrol_info if fuel_type == "petrol" else self._diesel_info
        model_version = info["version"] if info else None

        log_forecast_predictions(points, fuel_type, model_version)

        return {
            "fuel_type": fuel_type,
            "current_price": round(current_price, 3),
            "forecast_days": days,
            "trend": trend,
            "change_pct": round(pct_change, 1),
            "avg_forecast": round(avg_pred, 3),
            "min_forecast": round(min_pred, 3),
            "max_forecast": round(max_pred, 3),
            "confidence_interval": {
                "lower": round(float(np.mean(lower)), 3),
                "upper": round(float(np.mean(upper)), 3),
            },
            "points": points,
            "recommendation": recommendation,
            "model": model_name,
            "model_version": model_version,
            "evaluation": evaluation,
            "feature_importance": feature_imp,
        }

    @staticmethod
    def _generate_recommendation(
        trend: str, pct_change: float, avg_pred: float, current: float
    ) -> dict:
        if trend == "up":
            return {
                "action": "buy_now",
                "title": "Prices Expected to Rise",
                "message": f"Forecast shows a {pct_change:.1f}% increase over the next 30 days. Consider filling up soon to lock in current rates.",
                "urgency": "high" if pct_change > 3 else "medium",
            }
        elif trend == "down":
            return {
                "action": "wait",
                "title": "Prices Expected to Drop",
                "message": f"Forecast indicates a {abs(pct_change):.1f}% decrease. Waiting to refuel may save you money.",
                "urgency": "low",
            }
        return {
            "action": "monitor",
            "title": "Prices Stable",
            "message": "No significant price movement expected in the next 30 days. Monitor for changes.",
            "urgency": "none",
        }


# ------------------------------------------------------------------
# Singleton accessor
# ------------------------------------------------------------------

_forecaster_instance: Optional[FuelForecaster] = None


def get_forecaster() -> FuelForecaster:
    """Return the singleton forecaster.

    The model is loaded from disk on the first call (cold start) and only
    retrains when ``_retrain_if_needed`` detects new DB records.
    """
    global _forecaster_instance

    if _forecaster_instance is None:
        _forecaster_instance = FuelForecaster()
        logger.info("Forecaster initialized (loaded from disk or trained)")

    return _forecaster_instance
