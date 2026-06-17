import numpy as np
from typing import Optional
from numpy import ndarray


def _ols_coefficients(X: np.ndarray, y: np.ndarray) -> np.ndarray:
    XtX = X.T @ X
    try:
        inv = np.linalg.inv(XtX)
    except np.linalg.LinAlgError:
        inv = np.linalg.pinv(XtX)
    return inv @ X.T @ y


def _predict_internal(X: np.ndarray, coef: np.ndarray) -> np.ndarray:
    return X @ coef


class SKLearnWrapper:
    """Wraps sklearn LinearRegression if available, else falls back to numpy OLS."""
    _model: Optional[object] = None
    _coef: Optional[np.ndarray] = None

    def fit(self, X: np.ndarray, y: np.ndarray) -> None:
        try:
            from sklearn.linear_model import LinearRegression
            self._model = LinearRegression()
            self._model.fit(X, y)
            self._coef = None
        except ImportError:
            self._model = None
            self._coef = _ols_coefficients(X, y)

    def predict(self, X: np.ndarray) -> np.ndarray:
        if self._model is not None:
            return self._model.predict(X)
        return _predict_internal(X, self._coef)


class XGBoostWrapper:
    """Wraps XGBoost if available, returns availability flag."""
    _model: Optional[object] = None
    available: bool = False

    def fit(self, X: np.ndarray, y: np.ndarray) -> None:
        try:
            import xgboost as xgb
            self._model = xgb.XGBRegressor(
                n_estimators=100, max_depth=4, learning_rate=0.05,
                random_state=42, verbosity=0,
            )
            self._model.fit(X, y)
            self.available = True
        except ImportError:
            self.available = False

    def predict(self, X: np.ndarray) -> np.ndarray:
        if self._model is not None:
            return self._model.predict(X)
        raise RuntimeError("XGBoost not available, fit() first or use fallback")


class EnsembleForecaster:
    """Combines linear + tree models with fallback to pure numpy."""

    def __init__(self):
        self.linear = SKLearnWrapper()
        self.tree = XGBoostWrapper()
        self._fitted = False

    def fit(self, X: np.ndarray, y: np.ndarray) -> None:
        self.linear.fit(X, y)
        self.tree.fit(X, y)
        self._fitted = True

    def predict(self, X: np.ndarray) -> np.ndarray:
        if not self._fitted:
            raise RuntimeError("Model not fitted")

        linear_pred = self.linear.predict(X)
        if self.tree.available:
            tree_pred = self.tree.predict(X)
            return 0.4 * linear_pred + 0.6 * tree_pred
        return linear_pred

    def predict_with_ci(self, X_future: ndarray, y_hist: ndarray, X_hist: Optional[ndarray] = None) -> tuple[ndarray, ndarray, ndarray]:
        preds = self.predict(X_future)
        train_preds = self.predict(X_hist) if X_hist is not None else preds[:len(y_hist)]
        residuals = y_hist[:len(train_preds)] - train_preds[:len(y_hist)]

        std = np.std(residuals) if len(residuals) > 1 else 0.02
        z = 1.96

        lower = preds - z * std
        upper = preds + z * std
        return preds, lower, upper
