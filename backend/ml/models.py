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

    @property
    def feature_importance(self) -> Optional[ndarray]:
        if self._model is not None and hasattr(self._model, 'feature_importances_'):
            return self._model.feature_importances_
        return None


class EnsembleForecaster:
    """Combines linear + random forest + xgboost models with fallback to pure numpy."""

    def __init__(self):
        self.linear = SKLearnWrapper()
        self.rf = RandomForestWrapper()
        self.tree = XGBoostWrapper()
        self._fitted = False
        self._feature_names = ["day_index", "weekly_sin", "weekly_cos", "yearly_sin"]

    def fit(self, X: np.ndarray, y: np.ndarray) -> None:
        self.linear.fit(X, y)
        self.rf.fit(X, y)
        self.tree.fit(X, y)
        self._fitted = True

    def predict(self, X: np.ndarray) -> np.ndarray:
        if not self._fitted:
            raise RuntimeError("Model not fitted")

        preds = [self.linear.predict(X)]
        if self.rf.available:
            preds.append(self.rf.predict(X))
        if self.tree.available:
            preds.append(self.tree.predict(X))

        if len(preds) == 1:
            return preds[0]
        return np.mean(preds, axis=0)

    def evaluate(self, X: ndarray, y: ndarray) -> dict:
        preds = self.predict(X)
        residuals = y - preds
        mae = float(np.mean(np.abs(residuals)))
        rmse = float(np.sqrt(np.mean(residuals ** 2)))
        ss_res = np.sum(residuals ** 2)
        ss_tot = np.sum((y - np.mean(y)) ** 2)
        r2 = float(1 - ss_res / ss_tot) if ss_tot > 0 else 0.0
        return {"mae": round(mae, 4), "rmse": round(rmse, 4), "r2": round(r2, 4)}

    def feature_importance(self) -> dict:
        """Aggregate feature importance across all available models."""
        importance_map = {}
        for name in self._feature_names:
            importance_map[name] = []

        for model, label in [(self.linear, "linear"), (self.rf, "rf"), (self.tree, "xgboost")]:
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
        preds = self.predict(X_future)
        train_preds = self.predict(X_hist) if X_hist is not None else preds[:len(y_hist)]
        residuals = y_hist[:len(train_preds)] - train_preds[:len(y_hist)]

        std = np.std(residuals) if len(residuals) > 1 else 0.02
        z = 1.96

        lower = preds - z * std
        upper = preds + z * std
        return preds, lower, upper
