"""ML models for fuel price forecasting.

Three model types:
  1. LinearRegression   — via sklearn (fallback: numpy OLS)
  2. RandomForest       — via sklearn (optional)
  3. ARIMA              — via statsmodels (time-series native, optional)

EnsembleForecaster averages predictions from all available models.
"""

import numpy as np
from typing import Optional
from numpy import ndarray


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _ols_coefficients(X: np.ndarray, y: np.ndarray) -> np.ndarray:
    XtX = X.T @ X
    try:
        inv = np.linalg.inv(XtX)
    except np.linalg.LinAlgError:
        inv = np.linalg.pinv(XtX)
    return inv @ X.T @ y


def _predict_internal(X: np.ndarray, coef: np.ndarray) -> np.ndarray:
    return X @ coef


# ---------------------------------------------------------------------------
# Model 1 — Linear Regression
# ---------------------------------------------------------------------------

class SKLearnWrapper:
    """Wraps sklearn LinearRegression if available, else falls back to numpy OLS."""
    _model: Optional[object] = None
    _coef: Optional[np.ndarray] = None
    available: bool = False

    def fit(self, X: np.ndarray, y: np.ndarray) -> None:
        try:
            from sklearn.linear_model import LinearRegression
            self._model = LinearRegression()
            self._model.fit(X, y)
            self._coef = None
            self.available = True
        except ImportError:
            self._model = None
            self._coef = _ols_coefficients(X, y)
            self.available = True

    def predict(self, X: np.ndarray) -> np.ndarray:
        if self._model is not None:
            return self._model.predict(X)
        return _predict_internal(X, self._coef)

    @property
    def feature_importance(self) -> Optional[ndarray]:
        if self._model is not None and hasattr(self._model, 'coef_'):
            return np.abs(self._model.coef_)
        if self._coef is not None:
            return np.abs(self._coef)
        return None


# ---------------------------------------------------------------------------
# Model 2 — Random Forest
# ---------------------------------------------------------------------------

class RandomForestWrapper:
    """Wraps sklearn RandomForest if available."""
    _model: Optional[object] = None
    available: bool = False

    def fit(self, X: np.ndarray, y: np.ndarray) -> None:
        try:
            from sklearn.ensemble import RandomForestRegressor
            self._model = RandomForestRegressor(
                n_estimators=100, max_depth=6,
                random_state=42, n_jobs=-1,
            )
            self._model.fit(X, y)
            self.available = True
        except ImportError:
            self.available = False

    def predict(self, X: np.ndarray) -> np.ndarray:
        if self._model is not None:
            return self._model.predict(X)
        raise RuntimeError("RandomForest not available")

    @property
    def feature_importance(self) -> Optional[ndarray]:
        if self._model is not None and hasattr(self._model, 'feature_importances_'):
            return self._model.feature_importances_
        return None


# ---------------------------------------------------------------------------
# Model 3 — ARIMA Time Series
# ---------------------------------------------------------------------------

class TimeSeriesWrapper:
    """Wraps statsmodels ARIMA for native time-series forecasting.

    Unlike the regression models above, ARIMA operates on the raw 1-D price
    series directly — no engineered features needed.
    """

    _model: Optional[object] = None
    _order: tuple[int, int, int] = (2, 1, 2)
    _series: Optional[np.ndarray] = None
    available: bool = False

    def fit(self, y: np.ndarray) -> None:
        """Fit ARIMA on the raw price series y (1-D)."""
        self._series = y
        try:
            from statsmodels.tsa.arima.model import ARIMA as ArimaModel
            self._model = ArimaModel(y, order=self._order)
            self._model = self._model.fit()
            self.available = True
        except Exception:
            self.available = False

    def forecast(self, steps: int) -> np.ndarray:
        """Generate step-ahead predictions."""
        if self._model is None:
            raise RuntimeError("ARIMA not fitted")
        result = self._model.forecast(steps=steps)
        return np.maximum(result.values, 0.5)

    def predict_in_sample(self) -> np.ndarray:
        """Return fitted values over the training period."""
        if self._model is None:
            raise RuntimeError("ARIMA not fitted")
        return np.maximum(self._model.fittedvalues.values, 0.5)

    @property
    def aic(self) -> Optional[float]:
        if self._model is not None:
            return float(self._model.aic)
        return None


# ---------------------------------------------------------------------------
# Ensemble — combine all three
# ---------------------------------------------------------------------------

class EnsembleForecaster:
    """Combines Linear + RandomForest + ARIMA models with weighted averaging.

    Feature-engineered models (Linear, RF) share feature matrix X.
    ARIMA operates on raw 1-D series and is blended at the prediction level.
    """

    def __init__(self):
        self.linear = SKLearnWrapper()
        self.rf = RandomForestWrapper()
        self.arima = TimeSeriesWrapper()
        self._fitted = False
        self._feature_names = ["day_index", "weekly_sin", "weekly_cos", "yearly_sin", "momentum", "weekly_diff"]

    def fit(self, X: np.ndarray, y: np.ndarray, y_raw: Optional[np.ndarray] = None) -> None:
        """Fit all models.

        Parameters
        ----------
        X : np.ndarray  — engineered feature matrix (for Linear / RF)
        y : np.ndarray  — target prices (for Linear / RF)
        y_raw : np.ndarray | None — raw 1-D series (for ARIMA, defaults to y)
        """
        self.linear.fit(X, y)
        self.rf.fit(X, y)
        if y_raw is not None:
            self.arima.fit(y_raw)
        else:
            self.arima.fit(y)
        self._fitted = True

    def forecast_regression(self, X_future: np.ndarray) -> np.ndarray:
        """Predict using feature-based models (Linear + RF)."""
        if not self._fitted:
            raise RuntimeError("Model not fitted")

        preds = [self.linear.predict(X_future)]
        if self.rf.available:
            preds.append(self.rf.predict(X_future))

        if len(preds) == 1:
            return preds[0]
        return np.mean(preds, axis=0)

    def forecast_arima(self, steps: int) -> Optional[np.ndarray]:
        """Predict using ARIMA (raw series)."""
        if not self.arima.available:
            return None
        return self.arima.forecast(steps)

    def blend(self, reg_preds: np.ndarray, arima_preds: Optional[np.ndarray], weight_arima: float = 0.3) -> np.ndarray:
        """Weighted blend of regression and ARIMA forecasts.

        When ARIMA is unavailable, pure regression is returned.
        """
        if arima_preds is None:
            return reg_preds
        if len(arima_preds) != len(reg_preds):
            return reg_preds
        return (1 - weight_arima) * reg_preds + weight_arima * arima_preds

    def evaluate(self, X: ndarray, y: ndarray) -> dict:
        """Evaluate regression models on training data."""
        preds = self.forecast_regression(X)
        residuals = y - preds
        mae = float(np.mean(np.abs(residuals)))
        rmse = float(np.sqrt(np.mean(residuals ** 2)))
        ss_res = np.sum(residuals ** 2)
        ss_tot = np.sum((y - np.mean(y)) ** 2)
        r2 = float(1 - ss_res / ss_tot) if ss_tot > 0 else 0.0
        result = {"mae": round(mae, 4), "rmse": round(rmse, 4), "r2": round(r2, 4)}
        if self.arima.available and self.arima.aic is not None:
            result["arima_aic"] = round(self.arima.aic, 2)
        return result

    def feature_importance(self) -> dict:
        importance_map = {}
        for name in self._feature_names:
            importance_map[name] = []

        for model, label in [(self.linear, "linear"), (self.rf, "rf")]:
            imp = model.feature_importance
            if imp is not None:
                for i, name in enumerate(self._feature_names):
                    if i < len(imp):
                        importance_map[name].append(float(imp[i]))

        result = {}
        for name, vals in importance_map.items():
            if vals:
                result[name] = round(sum(vals) / len(vals), 4)
            else:
                result[name] = 0.0
        return result

    def predict_with_ci(self, X_future: ndarray, y_hist: ndarray, X_hist: Optional[ndarray] = None) -> tuple[ndarray, ndarray, ndarray]:
        """Generate blended predictions with confidence intervals."""
        reg_preds = self.forecast_regression(X_future)
        arima_preds = self.forecast_arima(len(X_future))
        preds = self.blend(reg_preds, arima_preds)

        train_preds = self.forecast_regression(X_hist) if X_hist is not None else reg_preds[:len(y_hist)]
        residuals = y_hist[:len(train_preds)] - train_preds[:len(y_hist)]

        std = np.std(residuals) if len(residuals) > 1 else 0.02
        z = 1.96

        lower = preds - z * std
        upper = preds + z * std
        return preds, lower, upper
