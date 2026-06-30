import numpy as np
from backend.ml.data import (
    generate_training_data,
    prepare_features,
    clean_data,
    build_arima_series,
)


class TestGenerateTrainingData:
    def test_returns_list_of_dicts(self):
        data = generate_training_data(days=30, seed_val=42)
        assert isinstance(data, list)
        assert len(data) == 30
        for d in data:
            assert "date" in d
            assert "timestamp" in d
            assert "petrol" in d
            assert "diesel" in d
            assert isinstance(d["petrol"], float)
            assert isinstance(d["diesel"], float)

    def test_prices_are_reasonable(self):
        data = generate_training_data(days=365, seed_val=42)
        petrols = [d["petrol"] for d in data]
        diesels = [d["diesel"] for d in data]
        assert all(0 < p < 5 for p in petrols)
        assert all(0 < d < 5 for d in diesels)

    def test_seed_produces_reproducible_output(self):
        data1 = generate_training_data(days=10, seed_val=42)
        data2 = generate_training_data(days=10, seed_val=42)
        for d1, d2 in zip(data1, data2):
            assert d1["petrol"] == d2["petrol"]
            assert d1["diesel"] == d2["diesel"]


class TestCleanData:
    def test_forward_fills_none_values(self):
        data = [
            {"date": "2026-01-01", "timestamp": 1, "petrol": 1.5, "diesel": 1.7},
            {"date": "2026-01-02", "timestamp": 2, "petrol": None, "diesel": 1.8},
            {"date": "2026-01-03", "timestamp": 3, "petrol": 1.6, "diesel": 1.9},
        ]
        cleaned = clean_data(data, "petrol")
        date_02 = [d for d in cleaned if d["date"] == "2026-01-02"][0]
        assert date_02["petrol"] == 1.5

    def test_forward_fills_gaps(self):
        data = [
            {"date": "2026-01-01", "timestamp": 1, "petrol": 1.5, "diesel": 1.7},
            {"date": "2026-01-03", "timestamp": 3, "petrol": 1.6, "diesel": 1.9},
        ]
        cleaned = clean_data(data, "petrol")
        dates = [d["date"] for d in cleaned]
        assert "2026-01-02" in dates
        assert len(cleaned) == 3

    def test_forward_filled_price_matches_previous(self):
        data = [
            {"date": "2026-01-01", "timestamp": 1, "petrol": 1.5, "diesel": 1.7},
            {"date": "2026-01-03", "timestamp": 3, "petrol": 1.6, "diesel": 1.9},
        ]
        cleaned = clean_data(data, "petrol")
        gap = [d for d in cleaned if d["date"] == "2026-01-02"][0]
        assert gap["petrol"] == 1.5

    def test_removes_outliers(self):
        data = [
            {"date": f"2026-01-{i:02d}", "timestamp": float(i),
             "petrol": 100.0 if i == 5 else 1.6, "diesel": 1.7}
            for i in range(1, 11)
        ]
        cleaned = clean_data(data, "petrol")
        petrols = [d["petrol"] for d in cleaned]
        assert all(p < 50 for p in petrols)

    def test_empty_input_returns_empty(self):
        assert clean_data([], "petrol") == []

    def test_sorts_chronologically(self):
        data = [
            {"date": "2026-01-03", "timestamp": 3, "petrol": 1.6, "diesel": 1.9},
            {"date": "2026-01-01", "timestamp": 1, "petrol": 1.5, "diesel": 1.7},
        ]
        cleaned = clean_data(data, "petrol")
        assert cleaned[0]["date"] == "2026-01-01"


class TestPrepareFeatures:
    def test_returns_correct_shapes(self):
        data = generate_training_data(days=50, seed_val=42)
        X, y, timestamps = prepare_features(data, "petrol")
        assert X.shape == (50, 6)
        assert y.shape == (50,)
        assert timestamps.shape == (50,)

    def test_feature_values(self):
        data = generate_training_data(days=3, seed_val=42)
        X, y, _ = prepare_features(data, "petrol")
        assert X[0, 0] == 0
        assert X[1, 0] == 1
        assert X[2, 0] == 2
        assert all(-1 <= v <= 1 for v in X[:, 1])
        assert all(-1 <= v <= 1 for v in X[:, 2])
        assert all(-1 <= v <= 1 for v in X[:, 3])
        assert X[0, 4] == 0
        assert X[0, 5] == 0

    def test_diesel_separate_from_petrol(self):
        data = generate_training_data(days=10, seed_val=42)
        X_p, y_p, _ = prepare_features(data, "petrol")
        X_d, y_d, _ = prepare_features(data, "diesel")
        assert not np.array_equal(y_p, y_d)


class TestBuildArimaSeries:
    def test_returns_1d_array(self):
        data = generate_training_data(days=10, seed_val=42)
        series = build_arima_series(data, "petrol")
        assert isinstance(series, np.ndarray)
        assert series.ndim == 1
        assert len(series) == 10

    def test_values_match_original(self):
        data = generate_training_data(days=10, seed_val=42)
        series = build_arima_series(data, "petrol")
        for i, d in enumerate(data):
            assert series[i] == d["petrol"]
