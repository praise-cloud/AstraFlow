import numpy as np
from backend.ml.models import (
    SKLearnWrapper,
    TimeSeriesWrapper,
    EnsembleForecaster,
)


def _sample_data(n: int = 100) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(42)
    X = rng.random((n, 4))
    y = 2.0 * X[:, 0] + 1.5 * X[:, 1] + rng.normal(0, 0.05, n)
    return X, y


class TestSKLearnWrapper:
    def test_fit_and_predict(self):
        X, y = _sample_data(50)
        model = SKLearnWrapper()
        model.fit(X, y)
        preds = model.predict(X)
        assert preds.shape == (50,)
        assert np.all(np.isfinite(preds))

    def test_fit_with_numpy_fallback(self):
        X = np.array([[1, 2], [3, 4], [5, 6]], dtype=np.float64)
        y = np.array([3, 7, 11], dtype=np.float64)
        model = SKLearnWrapper()
        model.fit(X, y)
        preds = model.predict(X)
        assert preds.shape == (3,)
        assert np.all(np.isfinite(preds))


class TestTimeSeriesWrapper:
    def test_fit_and_forecast(self):
        rng = np.random.default_rng(42)
        y = 1.6 + np.cumsum(rng.normal(0, 0.01, 60))
        model = TimeSeriesWrapper()
        model.fit(y)
        if model.available:
            preds = model.forecast(steps=10)
            assert preds.shape == (10,)
            assert np.all(np.isfinite(preds))
            assert np.all(preds >= 0.5)

    def test_not_available_when_statsmodels_missing(self):
        model = TimeSeriesWrapper()
        try:
            import statsmodels
        except ImportError:
            assert model.available is False


class TestEnsembleForecaster:
    def test_fit_and_forecast(self):
        X, y = _sample_data(100)
        ensemble = EnsembleForecaster()
        ensemble.fit(X, y, y_raw=y)
        preds = ensemble.forecast_regression(X)
        assert preds.shape == (100,)
        assert np.all(np.isfinite(preds))

    def test_blend_without_arima(self):
        X, y = _sample_data(100)
        ensemble = EnsembleForecaster()
        ensemble.fit(X, y)
        reg = ensemble.forecast_regression(X)
        blended = ensemble.blend(reg, arima_preds=None)
        assert np.array_equal(reg, blended)

    def test_blend_with_arima(self):
        X, y = _sample_data(100)
        ensemble = EnsembleForecaster()
        ensemble.fit(X, y, y_raw=y)
        reg = ensemble.forecast_regression(X)
        if ensemble.arima.available:
            arima = ensemble.arima.forecast(steps=100)
            blended = ensemble.blend(reg, arima, weight_arima=0.3)
            assert blended.shape == reg.shape
            assert np.all(np.isfinite(blended))

    def test_predict_with_ci(self):
        X, y = _sample_data(100)
        ensemble = EnsembleForecaster()
        ensemble.fit(X, y, y_raw=y)
        X_future = np.random.default_rng(1).random((10, 4))
        preds, lower, upper = ensemble.predict_with_ci(X_future, y, X_hist=X)
        assert preds.shape == (10,)
        assert lower.shape == (10,)
        assert upper.shape == (10,)
        assert np.all(lower <= preds)
        assert np.all(preds <= upper)

    def test_not_fitted_raises(self):
        ensemble = EnsembleForecaster()
        X = np.array([[1, 2, 3, 4]])
        try:
            ensemble.forecast_regression(X)
            assert False, "Should have raised"
        except RuntimeError:
            pass
