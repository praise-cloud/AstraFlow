import numpy as np
from backend.ml.data import generate_training_data, prepare_features


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
