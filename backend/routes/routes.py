import os
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Any
import httpx

from backend.routes.dashboard import get_current_user
from backend.models.user import User
from backend.services.gas_station_service import find_stations_nearby, find_stations_along_route
from backend.services.route_optimizer import rank_routes

router = APIRouter(prefix="/api/routes", tags=["routes"])

OSRM_URL = "https://router.project-osrm.org"
NOMINATIM_URL = "https://nominatim.openstreetmap.org"
TOMTOM_API_KEY = os.getenv("TOMTOM_API_KEY", "")


class PlanRequest(BaseModel):
    origin: str
    destination: str
    origin_lat: float | None = None
    origin_lng: float | None = None
    destination_lat: float | None = None
    destination_lng: float | None = None
    fuel_type: str = "petrol"


class PlanResponse(BaseModel):
    routes: list[dict[str, Any]]
    fuel_price_used: dict[str, float]


@router.get("/geocode")
def geocode(
    q: str = Query(..., min_length=2),
    user: User = Depends(get_current_user),
):
    try:
        resp = httpx.get(
            f"{NOMINATIM_URL}/search",
            params={"q": q, "format": "json", "limit": 5, "countrycodes": "mu"},
            headers={"User-Agent": "AstraFlow/1.0"},
            timeout=10,
        )
        resp.raise_for_status()
        results = resp.json()
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Geocoding service unavailable")

    return [
        {
            "display_name": r["display_name"],
            "lat": float(r["lat"]),
            "lng": float(r["lon"]),
        }
        for r in results
    ]


@router.post("/plan")
def plan_route(
    body: PlanRequest,
    user: User = Depends(get_current_user),
):
    orig_lat, orig_lng = body.origin_lat, body.origin_lng
    dest_lat, dest_lng = body.destination_lat, body.destination_lng

    if orig_lat is None or orig_lng is None:
        orig_lat, orig_lng = _geocode_single(body.origin)
    if dest_lat is None or dest_lng is None:
        dest_lat, dest_lng = _geocode_single(body.destination)

    osrm_routes = _fetch_osrm_routes(orig_lat, orig_lng, dest_lat, dest_lng)
    if not osrm_routes:
        raise HTTPException(status_code=502, detail="Routing service unavailable")

    traffic_data = _fetch_tomtom_traffic(orig_lat, orig_lng, dest_lat, dest_lng) if TOMTOM_API_KEY else []

    from backend.db.database import SessionLocal
    from backend.models.fuel_price import FuelPrice
    from datetime import datetime, timezone, timedelta

    db = SessionLocal()
    try:
        recent = (
            db.query(FuelPrice)
            .filter(FuelPrice.fuel_type == body.fuel_type, FuelPrice.date >= datetime.now(timezone.utc).date() - timedelta(days=7))
            .order_by(FuelPrice.date.desc())
            .first()
        )
        fuel_price = float(recent.price) if recent else 1.64
    finally:
        db.close()

    parsed = []
    for i, r in enumerate(osrm_routes):
        distance_km = round(r["distance"] / 1000, 1)
        duration_min = round(r["duration"] / 60, 1)
        traffic_delay = 0
        congestion = "low"
        if i < len(traffic_data):
            traffic_delay = traffic_data[i].get("delay_min", 0)
            congestion = traffic_data[i].get("congestion", "low")

        polyline = _decode_polyline(r["geometry"])
        gas_stations = find_stations_along_route(polyline, radius_km=1.5)

        route_obj = {
            "distance_km": distance_km,
            "duration_min": duration_min,
            "traffic_delay_min": traffic_delay,
            "congestion": congestion,
            "polyline": _encode_polyline(polyline),
            "gas_stations": gas_stations,
            "gas_station_savings": 0,
            "legs": [
                {
                    "distance_km": round(leg["distance"] / 1000, 1),
                    "duration_min": round(leg["duration"] / 60, 1),
                    "summary": leg.get("summary", ""),
                }
                for leg in r.get("legs", [])
            ],
        }
        parsed.append(route_obj)

    ranked = rank_routes(parsed, fuel_price)
    return PlanResponse(
        routes=ranked,
        fuel_price_used={body.fuel_type: fuel_price},
    )


@router.get("/gas-stations")
def gas_stations(
    lat: float = Query(...),
    lng: float = Query(...),
    radius: float = Query(default=5.0, ge=0.5, le=50),
    user: User = Depends(get_current_user),
):
    return find_stations_nearby(lat, lng, radius)


def _geocode_single(query: str) -> tuple[float, float]:
    try:
        resp = httpx.get(
            f"{NOMINATIM_URL}/search",
            params={"q": query, "format": "json", "limit": 1, "countrycodes": "mu"},
            headers={"User-Agent": "AstraFlow/1.0"},
            timeout=10,
        )
        resp.raise_for_status()
        results = resp.json()
        if not results:
            raise HTTPException(status_code=400, detail=f"Could not geocode: {query}")
        return float(results[0]["lat"]), float(results[0]["lon"])
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Geocoding service unavailable")


def _fetch_osrm_routes(lat1: float, lng1: float, lat2: float, lng2: float) -> list[dict]:
    try:
        resp = httpx.get(
            f"{OSRM_URL}/route/v1/driving/{lng1},{lat1};{lng2},{lat2}",
            params={
                "overview": "full",
                "geometries": "polyline",
                "steps": "true",
                "alternatives": "true",
                "continue_straight": "false",
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("routes", [])
    except httpx.HTTPError:
        return []


def _fetch_tomtom_traffic(lat1: float, lng1: float, lat2: float, lng2: float) -> list[dict]:
    try:
        resp = httpx.get(
            f"https://api.tomtom.com/routing/1/calculateRoute/{lat1},{lng1}:{lat2},{lng2}/json",
            params={
                "key": TOMTOM_API_KEY,
                "traffic": "true",
                "routeType": "shortest",
                "maxAlternatives": "2",
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        routes_data = data.get("routes", [])
        result = []
        for r in routes_data:
            summary = r.get("summary", {})
            delay = summary.get("trafficDelayInSeconds", 0)
            result.append({
                "delay_min": round(delay / 60, 1),
                "congestion": _map_tomtom_congestion(summary.get("trafficLengthInMeters", 0), summary.get("lengthInMeters", 1)),
            })
        return result
    except httpx.HTTPError:
        return []


def _map_tomtom_congestion(traffic_length: float, total_length: float) -> str:
    ratio = traffic_length / max(total_length, 1)
    if ratio > 0.3:
        return "heavy"
    if ratio > 0.1:
        return "moderate"
    return "low"


def _decode_polyline(polyline: str) -> list[tuple[float, float]]:
    import polyline as pl
    return pl.decode(polyline)


def _encode_polyline(coords: list[tuple[float, float]]) -> str:
    import polyline as pl
    return pl.encode(coords)
