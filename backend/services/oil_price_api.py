"""Global crude oil & fuel price API via OilPriceAPI."""
import os
from datetime import datetime, timezone
from typing import Optional
import httpx

BASE_URL = "https://api.oilpriceapi.com/v1"
DEMO_URL = "https://api.oilpriceapi.com/v1/demo"

_CACHE: dict = {"data": None, "ts": None}


def _fallback() -> dict:
    return {
        "brent": None, "wti": None,
        "diesel_global": None, "gasoline_global": None,
        "updated_at": None, "source": "fallback",
    }


def _get_api_key() -> Optional[str]:
    key = os.getenv("OIL_PRICE_API_KEY", "")
    return key.strip() or None


def fetch_global_prices() -> dict:
    now = datetime.now(timezone.utc)
    if _CACHE["data"] and _CACHE["ts"] and (now - _CACHE["ts"]).total_seconds() < 300:
        return _CACHE["data"]

    key = _get_api_key()
    base = BASE_URL if key else DEMO_URL
    headers = {"Authorization": f"Token {key}"} if key else {}

    try:
        resp = httpx.get(f"{base}/prices/latest", headers=headers, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPError:
        _CACHE["data"] = _fallback()
        _CACHE["ts"] = now
        return _CACHE["data"]

    prices_raw = data.get("data", {}).get("prices", [])
    result = {"brent": None, "wti": None, "diesel_global": None, "gasoline_global": None}
    for p in prices_raw:
        code = p.get("code", "")
        price = p.get("price")
        if "BRENT" in code:
            result["brent"] = price
        elif "WTI" in code:
            result["wti"] = price
        elif "DIESEL" in code:
            result["diesel_global"] = price
        elif "GASOLINE" in code or "RBOB" in code:
            result["gasoline_global"] = price

    result["updated_at"] = data.get("data", {}).get("prices", [{}])[0].get("updated_at", now.isoformat())
    result["source"] = "OilPriceAPI"
    _CACHE["data"] = result
    _CACHE["ts"] = now
    return result
