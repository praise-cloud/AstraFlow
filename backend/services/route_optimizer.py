from typing import Any
import math

AVG_CONSUMPTION_L_PER_KM = 0.10
IDLE_FUEL_PER_MIN = 0.02


def score_route(
    distance_km: float,
    duration_min: float,
    traffic_delay_min: float,
    fuel_price: float,
    gas_station_savings: float = 0.0,
) -> dict[str, Any]:
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
        "fuel_cost_usd": round(fuel_cost + idle_cost, 2),
        "fuel_cost_before_idle": round(fuel_cost, 2),
        "idle_fuel_cost": round(idle_cost, 2),
        "estimated_liters": round(distance_km * AVG_CONSUMPTION_L_PER_KM, 1),
        "ai_score": normalized,
        "fuel_saved_if_optimized": round(fuel_saved, 2),
        "breakdown": {
            "distance_weight": 0.35,
            "time_weight": 0.25,
            "traffic_weight": 0.30,
            "gas_station_weight": 0.10,
        },
    }


def rank_routes(
    routes: list[dict[str, Any]],
    fuel_price: float,
) -> list[dict[str, Any]]:
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
