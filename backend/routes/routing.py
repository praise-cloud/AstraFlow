import logging
import httpx
from fastapi import APIRouter, Depends, Query, HTTPException
from backend.models.user import User
from backend.routes.dashboard import get_current_user
from backend.ml.forecast import get_forecaster
from backend.ml.data import load_training_data_from_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/routes", tags=["routes"])

OSRM_BASE = "https://router.project-osrm.org/route/v1/driving"
NOMINATIM = "https://nominatim.openstreetmap.org/search"
AVG_FUEL_L_PER_KM = 0.10


def _geocode(place: str) -> tuple[float, float] | None:
    try:
        resp = httpx.get(NOMINATIM, params={
            "q": place + ", Mauritius", "format": "json", "limit": 1,
        }, headers={"User-Agent": "AstraFlow/1.0"}, timeout=10)
        data = resp.json()
        if data:
            return (float(data[0]["lat"]), float(data[0]["lon"]))
    except Exception as e:
        logger.warning("Geocode failed for '%s': %s", place, e)
    return None


@router.get("/optimize")
def optimize_route(
    origin: str = Query(..., min_length=3),
    destination: str = Query(..., min_length=3),
    fuel_type: str = Query(default="petrol", pattern="^(petrol|diesel)$"),
    plan_date: str | None = Query(default=None, description="YYYY-MM-DD for future cost estimate"),
    user: User = Depends(get_current_user),
):
    orig_coords = _geocode(origin)
    dest_coords = _geocode(destination)
    if not orig_coords or not dest_coords:
        raise HTTPException(status_code=400, detail="Could not geocode origin or destination")

    forecaster = get_forecaster()
    forecast = forecaster.forecast(days=30, fuel_type=fuel_type)
    current_price = forecast["current_price"]
    avg_future = forecast["avg_forecast"]
    trend = forecast["trend"]

    osrm_url = f"{OSRM_BASE}/{orig_coords[1]},{orig_coords[0]};{dest_coords[1]},{dest_coords[0]}?overview=full&geometries=geojson&steps=true&alternatives=3"

    try:
        resp = httpx.get(osrm_url, timeout=15)
        resp.raise_for_status()
        osrm = resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Routing service error: {e}")

    if osrm.get("code") != "Ok" or not osrm.get("routes"):
        raise HTTPException(status_code=502, detail="No route found")

    routes = []
    for i, route in enumerate(osrm["routes"]):
        distance_km = round(route["distance"] / 1000, 1)
        duration_min = round(route["duration"] / 60, 1)
        fuel_liters = round(distance_km * AVG_FUEL_L_PER_KM, 1)
        cost_now = round(fuel_liters * current_price, 2)
        cost_future = round(fuel_liters * avg_future, 2)

        route_data = {
            "id": i + 1,
            "distance_km": distance_km,
            "duration_min": duration_min,
            "fuel_liters": fuel_liters,
            "cost_now": cost_now,
            "cost_future": cost_future,
            "savings_if_wait": round(max(cost_now - cost_future, 0), 2),
            "geometry": route["geometry"],
            "legs": [
                {
                    "distance_km": round(leg["distance"] / 1000, 1),
                    "duration_min": round(leg["duration"] / 60, 1),
                    "summary": leg.get("summary", ""),
                }
                for leg in route.get("legs", [])
            ],
        }
        routes.append(route_data)

    routes.sort(key=lambda r: r["cost_now"])

    return {
        "origin": {"query": origin, "lat": orig_coords[0], "lng": orig_coords[1]},
        "destination": {"query": destination, "lat": dest_coords[0], "lng": dest_coords[1]},
        "fuel_type": fuel_type,
        "current_price": current_price,
        "avg_future_price": avg_future,
        "trend": trend,
        "change_pct": forecast["change_pct"],
        "routes": routes,
    }
