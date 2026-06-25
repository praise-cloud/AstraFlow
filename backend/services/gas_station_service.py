from typing import Any
import httpx

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

MAURITIUS_BBOX = [-20.55, 57.28, -19.98, 57.85]


def fetch_gas_stations() -> list[dict[str, Any]]:
    overpass_query = f"""
    [out:json][timeout:30];
    (
      node["amenity"="fuel"]({MAURITIUS_BBOX[0]},{MAURITIUS_BBOX[1]},{MAURITIUS_BBOX[2]},{MAURITIUS_BBOX[3]});
      way["amenity"="fuel"]({MAURITIUS_BBOX[0]},{MAURITIUS_BBOX[1]},{MAURITIUS_BBOX[2]},{MAURITIUS_BBOX[3]});
      relation["amenity"="fuel"]({MAURITIUS_BBOX[0]},{MAURITIUS_BBOX[1]},{MAURITIUS_BBOX[2]},{MAURITIUS_BBOX[3]});
    );
    out center;
    """
    try:
        resp = httpx.post(OVERPASS_URL, data={"data": overpass_query}, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPError:
        return _fallback_stations()

    elements = data.get("elements", [])
    stations = []
    seen = set()
    for el in elements:
        lat = el.get("lat") or el.get("center", {}).get("lat")
        lng = el.get("lon") or el.get("center", {}).get("lon")
        if lat is None or lng is None:
            continue
        tags = el.get("tags", {})
        name = tags.get("name", "Fuel Station")
        brand = tags.get("brand", "")
        operator = tags.get("operator", "")
        display_name = brand or operator or name
        key = (round(lat, 4), round(lng, 4))
        if key in seen:
            continue
        seen.add(key)
        stations.append({
            "id": el["id"],
            "name": display_name,
            "lat": lat,
            "lng": lng,
            "brand": brand,
            "operator": operator,
        })
    if not stations:
        return _fallback_stations()
    return stations


def _fallback_stations() -> list[dict[str, Any]]:
    return [
        {"id": 1, "name": "Shell Port Louis", "lat": -20.1619, "lng": 57.4989, "brand": "Shell", "operator": ""},
        {"id": 2, "name": "TotalEnergies Curepipe", "lat": -20.3147, "lng": 57.5264, "brand": "TotalEnergies", "operator": ""},
        {"id": 3, "name": "Engen Rose Hill", "lat": -20.2269, "lng": 57.4697, "brand": "Engen", "operator": ""},
        {"id": 4, "name": "Shell Quatre Bornes", "lat": -20.2683, "lng": 57.4792, "brand": "Shell", "operator": ""},
        {"id": 5, "name": "TotalEnergies Beau Bassin", "lat": -20.2194, "lng": 57.4583, "brand": "TotalEnergies", "operator": ""},
        {"id": 6, "name": "Engen Phoenix", "lat": -20.1581, "lng": 57.4958, "brand": "Engen", "operator": ""},
        {"id": 7, "name": "Shell Grand Baie", "lat": -20.0175, "lng": 57.5822, "brand": "Shell", "operator": ""},
        {"id": 8, "name": "TotalEnergies Mahebourg", "lat": -20.4081, "lng": 57.7003, "brand": "TotalEnergies", "operator": ""},
        {"id": 9, "name": "Engen Floréal", "lat": -20.3078, "lng": 57.5108, "brand": "Engen", "operator": ""},
        {"id": 10, "name": "Shell Triolet", "lat": -20.0506, "lng": 57.5453, "brand": "Shell", "operator": ""},
        {"id": 11, "name": "TotalEnergies Vacoas", "lat": -20.2958, "lng": 57.5000, "brand": "TotalEnergies", "operator": ""},
        {"id": 12, "name": "Engen Goodlands", "lat": -20.0389, "lng": 57.6486, "brand": "Engen", "operator": ""},
        {"id": 13, "name": "Shell Rivière Noire", "lat": -20.3500, "lng": 57.3667, "brand": "Shell", "operator": ""},
        {"id": 14, "name": "TotalEnergies Rodrigues", "lat": -19.6833, "lng": 63.4167, "brand": "TotalEnergies", "operator": ""},
        {"id": 15, "name": "Engen Centre de Flacq", "lat": -20.1917, "lng": 57.7250, "brand": "Engen", "operator": ""},
        {"id": 16, "name": "APM Terminals", "lat": -20.1536, "lng": 57.4989, "brand": "", "operator": "APM Terminals"},
        {"id": 17, "name": "IPL Petrol Station", "lat": -20.1569, "lng": 57.4917, "brand": "IPL", "operator": ""},
        {"id": 18, "name": "Shell Bell Village", "lat": -20.1861, "lng": 57.4750, "brand": "Shell", "operator": ""},
        {"id": 19, "name": "TotalEnergies Plaine Verte", "lat": -20.1486, "lng": 57.5139, "brand": "TotalEnergies", "operator": ""},
        {"id": 20, "name": "Engen St Pierre", "lat": -20.2181, "lng": 57.5208, "brand": "Engen", "operator": ""},
    ]


_gas_stations_cache: list[dict[str, Any]] | None = None


def get_gas_stations(force_refresh: bool = False) -> list[dict[str, Any]]:
    global _gas_stations_cache
    if _gas_stations_cache is None or force_refresh:
        _gas_stations_cache = fetch_gas_stations()
    return _gas_stations_cache


def find_stations_nearby(lat: float, lng: float, radius_km: float = 5.0) -> list[dict[str, Any]]:
    stations = get_gas_stations()
    results = []
    for s in stations:
        d = _haversine(lat, lng, s["lat"], s["lng"])
        if d <= radius_km:
            results.append({**s, "distance_km": round(d, 2)})
    results.sort(key=lambda x: x["distance_km"])
    return results


def find_stations_along_route(polyline: list[tuple[float, float]], radius_km: float = 1.0) -> list[dict[str, Any]]:
    stations = get_gas_stations()
    matched = set()
    results = []
    for s in stations:
        min_dist = min(_haversine(s["lat"], s["lng"], lat, lng) for lat, lng in polyline)
        if min_dist <= radius_km:
            key = (round(s["lat"], 4), round(s["lng"], 4))
            if key not in matched:
                matched.add(key)
                results.append({**s, "distance_from_route_km": round(min_dist, 2)})
    results.sort(key=lambda x: x["distance_from_route_km"])
    return results


def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    import math
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
