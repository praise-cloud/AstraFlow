"""Route scoring and ranking — hybrid ML/heuristic approach.

Uses the ``RouteCostPredictor`` (GradientBoosting trained on actual route
outcomes) when available, falling back to the deterministic heuristic when
insufficient training data exists.
"""

from datetime import datetime
from typing import Any, Optional

from backend.ml.route_model import get_route_predictor

AVG_CONSUMPTION_L_PER_KM = 0.10
IDLE_FUEL_PER_MIN = 0.02


def _heuristic_score(
    distance_km: float,
    duration_min: float,
    traffic_delay_min: float,
    fuel_price: float,
    gas_station_savings: float = 0.0,
) -> dict[str, Any]:
    """Deterministic heuristic fallback when ML model is unavailable."""
    fuel_cost = distance_km * AVG_CONSUMPTION_L_PER_KM * fuel_price
    idle_cost = traffic_delay_min * IDLE_FUEL_PER_MIN * fuel_price
    total_fuel_cost = fuel_cost + idle_cost
    time_ratio = (duration_min + traffic_delay_min) / max(duration_min, 1)
    traffic_penalty = traffic_delay_min * 0.5

    raw_score = (
        0.35 * total_fuel_cost / 10
        + 0.25 * time_ratio
        + 0.30 * traffic_penalty / 10
        - 0.10 * gas_station_savings / 5
    )
    normalized = max(0, min(100, round((1 - raw_score) * 100)))
    fuel_saved = max(0, (fuel_cost + idle_cost) - gas_station_savings)

    return {
        "estimated_liters": round(distance_km * AVG_CONSUMPTION_L_PER_KM, 1),
        "ai_score": normalized,
        "fuel_saved_if_optimized": round(fuel_saved, 2),
        "score_source": "heuristic",
    }


def _ml_score(
    distance_km: float,
    duration_min: float,
    traffic_delay_min: float,
    fuel_price: float,
) -> Optional[dict[str, Any]]:
    """Score a route using the ML model.

    Returns ``None`` if the model is unavailable.
    """
    predictor = get_route_predictor()
    features = {
        "distance_km": distance_km,
        "duration_min": duration_min,
        "traffic_delay_min": traffic_delay_min,
        "time_of_day": datetime.now().hour,
        "day_of_week": datetime.now().weekday(),
        "fuel_price": fuel_price,
    }

    pred, lower, upper = predictor.predict_with_ci(features)
    if pred is None:
        return None

    ml_liters = _heuristic_score(distance_km, duration_min, traffic_delay_min, fuel_price)["estimated_liters"]
    max_cost = max(pred, ml_liters) * fuel_price
    normalized = max(0, min(100, round((1 - (pred * fuel_price) / max(max_cost, 0.01)) * 100)))

    return {
        "estimated_liters": round(pred, 2),
        "ai_score": normalized,
        "ai_score_ci": {
            "lower": round(lower, 2) if lower is not None else None,
            "upper": round(upper, 2) if upper is not None else None,
        },
        "fuel_saved_if_optimized": 0,
        "score_source": "ml",
    }


def score_route(
    distance_km: float,
    duration_min: float,
    traffic_delay_min: float,
    fuel_price: float,
    gas_station_savings: float = 0.0,
) -> dict[str, Any]:
    """Score a route — tries ML first, falls back to heuristic.

    Returns a dict with at minimum ``estimated_liters``, ``ai_score``,
    ``fuel_saved_if_optimized``, and ``score_source``.
    """
    fuel_cost = distance_km * AVG_CONSUMPTION_L_PER_KM * fuel_price
    idle_cost = traffic_delay_min * IDLE_FUEL_PER_MIN * fuel_price

    ml_result = _ml_score(distance_km, duration_min, traffic_delay_min, fuel_price)

    if ml_result is not None:
        result = ml_result
        result["fuel_cost_usd"] = round(fuel_cost + idle_cost, 2)
        result["fuel_cost_before_idle"] = round(fuel_cost, 2)
        result["idle_fuel_cost"] = round(idle_cost, 2)
        return result

    result = _heuristic_score(distance_km, duration_min, traffic_delay_min, fuel_price, gas_station_savings)
    result["fuel_cost_usd"] = round(fuel_cost + idle_cost, 2)
    result["fuel_cost_before_idle"] = round(fuel_cost, 2)
    result["idle_fuel_cost"] = round(idle_cost, 2)
    return result


def rank_routes(
    routes: list[dict[str, Any]],
    fuel_price: float,
) -> list[dict[str, Any]]:
    """Score and rank a list of routes by ai_score descending."""
    scored = []
    for route in routes:
        score_result = score_route(
            distance_km=route["distance_km"],
            duration_min=route["duration_min"],
            traffic_delay_min=route.get("traffic_delay_min", 0),
            fuel_price=fuel_price,
            gas_station_savings=route.get("gas_station_savings", 0),
        )
        scored.append({**route, **score_result})
    scored.sort(key=lambda r: r["ai_score"], reverse=True)
    for i, r in enumerate(scored):
        r["rank"] = i + 1
        r["recommendation"] = "Best fuel efficiency" if i == 0 else "Alternative route"
    return scored
