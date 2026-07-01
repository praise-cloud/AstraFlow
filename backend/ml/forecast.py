"""Fuel price forecasting — pipeline orchestrator.

Pipeline stages implemented here:
  1. Load historical data
  2. Clean data
  3. Extract features
  4. Train ensemble (Linear + RandomForest + ARIMA)
  5. Generate forecast

Continuous training: the forecaster singleton tracks the latest date in the
training set. On each request it checks whether new price records exist in
the DB. If so, it retrains automatically — keeping the model fresh without
retraining on every call.
"""

from datetime import datetime, timezone, timedelta
import threading
import numpy as np

from backend.ml.data import (
    load_training_data_from_db,
    generate_training_data,
    clean_data,
    prepare_features,
    build_arima_series,
)
from backend.ml.models import EnsembleForecaster


class FuelForecaster:
    """High-level forecaster orchestrating the 5-stage pipeline.

    Usage
    -----
        fc = FuelForecaster()
        fc.train()                          # stages 1-4
        result = fc.forecast(days=30)       # stage 5
    """

    def __init__(self):
        self._petrol_model = EnsembleForecaster()
        self._diesel_model = EnsembleForecaster()
        self._trained = False
        self._last_train_date: str | None = None

    # ------------------------------------------------------------------
    # Stage 1-2: Load + Clean
    # ------------------------------------------------------------------

    def _load_and_clean(self, history: list[dict] | None = None) -> list[dict]:
        """Load raw data (stage 1) and clean it (stage 2)."""
        data = history
        if data is None:
            data = load_training_data_from_db(365)
        if not data or len(data) < 14:
            data = generate_training_data(365)
        return data

    # ------------------------------------------------------------------
    # Stage 3: Feature extraction (called per-model inside train)
    # ------------------------------------------------------------------

    # ------------------------------------------------------------------
    # Stage 4: Train
    # ------------------------------------------------------------------

    def train(self, history: list[dict] | None = None) -> None:
        """Execute pipeline stages 1-4: load → clean → feature extract → train."""
        raw = self._load_and_clean(history)

        # Clean each fuel type separately
        cleaned_p = clean_data(raw, "petrol")
        cleaned_d = clean_data(raw, "diesel")

        # Feature extraction (stage 3) — for regression models
        X_p, y_p, _ = prepare_features(cleaned_p, "petrol")
        X_d, y_d, _ = prepare_features(cleaned_d, "diesel")

        # Raw series for ARIMA (stage 3 alternate path)
        y_p_raw = build_arima_series(cleaned_p, "petrol")
        y_d_raw = build_arima_series(cleaned_d, "diesel")

        # Train all models (stage 4)
        self._petrol_model.fit(X_p, y_p, y_raw=y_p_raw)
        self._diesel_model.fit(X_d, y_d, y_raw=y_d_raw)
        self._trained = True

        if cleaned_p:
            self._last_train_date = cleaned_p[-1]["date"]

    # ------------------------------------------------------------------
    # Continuous training — lazy retrain when new DB data exists
    # ------------------------------------------------------------------

    def _retrain_if_needed(self, force: bool = False) -> None:
        """Check DB for new price records and retrain if found.

        Call this before every forecast so the model stays current without
        retraining on every single request.
        """
        if not self._trained:
            self.train()
            return

        if force:
            self.train()
            return

        latest_db = load_training_data_from_db(30)
        if not latest_db:
            return

        latest_db_date = max(d["date"] for d in latest_db)
        if self._last_train_date is None or latest_db_date > self._last_train_date:
            self.train()

    # ------------------------------------------------------------------
    # Stage 5: Forecast generation
    # ------------------------------------------------------------------

    def forecast(
        self,
        days: int = 30,
        fuel_type: str = "petrol",
        history: list[dict] | None = None,
    ) -> dict:
        """Execute full pipeline and generate forecast.

        Steps inside:
          1. Retrain if new DB data exists (continuous learning)
          2. Load & clean data for feature construction
          3. Build future feature matrix
          4. Generate blended ensemble predictions + confidence intervals
          5. Compute evaluation metrics, trend, recommendation
          6. Return structured forecast result
        """
        self._retrain_if_needed()

        model = self._petrol_model if fuel_type == "petrol" else self._diesel_model

        # Load / clean data for this forecast call
        raw = self._load_and_clean(history)
        cleaned = clean_data(raw, fuel_type)
        X_train, y_train, timestamps = prepare_features(cleaned, fuel_type)

        # Build future feature matrix for regression models
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

        # Generate blended predictions with confidence intervals
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

        # Model name for display
        model_parts = ["Linear"]
        if model.rf.available:
            model_parts.append("RandomForest")
        if model.arima.available:
            model_parts.append("ARIMA")
        model_name = " + ".join(model_parts) + " Ensemble"

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

_forecaster_instance: FuelForecaster | None = None
_last_forecast_time: datetime | None = None
_RETRAIN_INTERVAL = timedelta(hours=6)
_forecaster_lock = threading.Lock()


def get_forecaster() -> FuelForecaster:
    """Return the singleton forecaster, retraining on a schedule.

    The model is trained:
      - On first call (cold start)
      - Every 6 hours thereafter (time-based refresh)
      - Immediately if `_retrain_if_needed` detects new DB records
    """
    global _forecaster_instance, _last_forecast_time

    now = datetime.now(timezone.utc)

    with _forecaster_lock:
        if _forecaster_instance is None:
            _forecaster_instance = FuelForecaster()
            _forecaster_instance.train()
            _last_forecast_time = now
    if _forecaster_instance is not None and _last_forecast_time and (now - _last_forecast_time) > _RETRAIN_INTERVAL:
        _forecaster_instance._retrain_if_needed(force=True)
        _last_forecast_time = now

    return _forecaster_instance
