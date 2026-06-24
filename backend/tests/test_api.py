from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


class TestHealthEndpoint:
    def test_health_returns_ok(self):
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "version" in data


class TestPricesEndpoint:
    def test_history_requires_auth(self):
        response = client.get("/api/prices/history?days=7")
        assert response.status_code in (401, 422)


class TestAuthEndpoints:
    def test_register_returns_422_with_invalid_data(self):
        response = client.post("/api/auth/register", json={})
        assert response.status_code == 422

    def test_login_returns_422_with_empty_body(self):
        response = client.post("/api/auth/login", json={})
        assert response.status_code == 422


class TestForecastEndpoint:
    def test_forecast_requires_auth(self):
        response = client.get("/api/forecast")
        assert response.status_code in (401, 422)

    def test_predict_requires_auth(self):
        response = client.get("/api/predict?liters=50")
        assert response.status_code in (401, 422)


class TestDashboardEndpoint:
    def test_dashboard_requires_auth(self):
        response = client.get("/api/dashboard")
        assert response.status_code in (401, 422)


class TestSurveyEndpoints:
    def test_list_surveys_requires_auth(self):
        response = client.get("/api/surveys")
        assert response.status_code in (401, 422)

    def test_submit_survey_requires_auth(self):
        response = client.post("/api/surveys", json={})
        assert response.status_code in (401, 422)

    def test_insights_requires_auth(self):
        response = client.get("/api/surveys/insights")
        assert response.status_code in (401, 422)


class TestNotificationEndpoints:
    def test_register_requires_auth(self):
        response = client.post(
            "/api/notifications/register",
            json={"token": "test", "platform": "expo"},
        )
        assert response.status_code in (401, 422)

    def test_unregister_requires_auth(self):
        response = client.delete("/api/notifications/register")
        assert response.status_code in (401, 422, 405)

    def test_preferences_requires_auth(self):
        response = client.get("/api/notifications/preferences")
        assert response.status_code in (401, 422)
