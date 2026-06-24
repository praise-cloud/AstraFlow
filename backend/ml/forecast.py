from datetime import datetime, timezone, timedelta
import numpy as np

from backend.ml.data import generate_training_data, prepare_features, load_training_data_from_db
from backend.ml.models import EnsembleForecaster


class FuelForecaster:
    """High-level forecaster that generates predictions for petrol and diesel."""

    def __init__(self):
        self._petrol_model = EnsembleForecaster()
        self._diesel_model = EnsembleForecaster()
        self._trained = False

    def train(self, history: list[dict] | None = None) -> None:
        data = history
        if data is None:
            data = load_training_data_from_db(365)
        if not data or len(data) < 14:
            data = generate_training_data(365)

        X_p, y_p, _ = prepare_features(data, "petrol")
        X_d, y_d, _ = prepare_features(data, "diesel")

        self._petrol_model.fit(X_p, y_p)
        self._diesel_model.fit(X_d, y_d)
        self._trained = True

    def forecast(
        self,
        days: int = 30,
        fuel_type: str = "petrol",
        history: list[dict] | None = None,
    ) -> dict:
        if not self._trained:
            self.train(history)

        model = self._petrol_model if fuel_type == "petrol" else self._diesel_model

        data = history
        if data is None:
            data = load_training_data_from_db(365)
        if not data or len(data) < 14:
            data = generate_training_data(365)
        X_train, y_train, timestamps = prepare_features(data, fuel_type)

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
        if model.tree.available:
            model_parts.append("XGBoost")
        model_name = " + ".join(model_parts) + " Ensemble" if len(model_parts) > 1 else f"{model_parts[0]} (numpy)"

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

    def _generate_recommendation(
        self, trend: str, pct_change: float, avg_pred: float, current: float
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


_forecaster_instance: FuelForecaster | None = None


def get_forecaster() -> FuelForecaster:
    global _forecaster_instance
    if _forecaster_instance is None:
        _forecaster_instance = FuelForecaster()
        _forecaster_instance.train()
    return _forecaster_instance
