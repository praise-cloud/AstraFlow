from backend.ml.forecast import FuelForecaster, get_forecaster
from backend.ml.data import generate_training_data


class TestFuelForecaster:
    def test_train_and_forecast(self):
        data = generate_training_data(days=100, seed_val=42)
        f = FuelForecaster()
        f.train(data)
        result = f.forecast(days=10, fuel_type="petrol", history=data)
        assert result["fuel_type"] == "petrol"
        assert result["forecast_days"] == 10
        assert len(result["points"]) == 10
        assert "trend" in result
        assert "recommendation" in result
        assert "action" in result["recommendation"]
        assert result["current_price"] > 0

    def test_forecast_diesel(self):
        data = generate_training_data(days=100, seed_val=42)
        f = FuelForecaster()
        f.train(data)
        result = f.forecast(days=5, fuel_type="diesel", history=data)
        assert result["fuel_type"] == "diesel"
        assert len(result["points"]) == 5

    def test_prices_positive(self):
        data = generate_training_data(days=100, seed_val=42)
        f = FuelForecaster()
        f.train(data)
        result = f.forecast(days=30, fuel_type="petrol", history=data)
        for p in result["points"]:
            assert p["predicted"] > 0

    def test_generate_recommendations(self):
        f = FuelForecaster()
        up = f._generate_recommendation("up", 5.0, 1.70, 1.60)
        assert up["action"] == "buy_now"

        down = f._generate_recommendation("down", -3.0, 1.50, 1.60)
        assert down["action"] == "wait"

        stable = f._generate_recommendation("stable", 0.5, 1.60, 1.60)
        assert stable["action"] == "monitor"


class TestGetForecaster:
    def test_get_forecaster_returns_instance(self):
        f = get_forecaster()
        assert isinstance(f, FuelForecaster)

    def test_get_forecaster_is_singleton(self):
        f1 = get_forecaster()
        f2 = get_forecaster()
        assert f1 is f2
