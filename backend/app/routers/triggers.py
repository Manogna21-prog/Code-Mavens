"""
SafeShift — Trigger Detection Endpoints
Polls external APIs (OpenWeatherMap, CPCB, Open-Meteo) and checks
against parametric thresholds.
"""

import os
import uuid
from datetime import datetime

import httpx
from fastapi import APIRouter, HTTPException

from app.models import (
    TriggerCheckRequest, TriggerEventResponse,
    TriggerType, TRIGGER_THRESHOLDS,
)

router = APIRouter(prefix="/api/triggers", tags=["Triggers"])

# In-memory store
_trigger_events: dict[str, dict] = {}

# Environment config
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY", "")
MOCK_MODE = os.getenv("MOCK_MODE", "true").lower() == "true"


# ── Mock data for demo / testing ─────────────────────────────────────

MOCK_SENSOR_DATA: dict[str, dict[TriggerType, float]] = {
    "110001": {  # Delhi — Central
        TriggerType.GRAP_IV: 480.0,        # AQI above 450 → triggers
        TriggerType.HEAVY_RAINFALL: 30.0,  # Below 65mm → no trigger
        TriggerType.CYCLONE: 20.0,         # Below 70 km/h → no trigger
    },
    "400001": {  # Mumbai — South
        TriggerType.GRAP_IV: 120.0,
        TriggerType.HEAVY_RAINFALL: 85.0,  # Above 65mm → triggers
        TriggerType.CYCLONE: 45.0,
    },
    "560001": {  # Bangalore
        TriggerType.GRAP_IV: 90.0,
        TriggerType.HEAVY_RAINFALL: 40.0,
        TriggerType.CYCLONE: 15.0,
    },
}


async def _fetch_live_weather(city: str, pincode: str) -> dict[TriggerType, float]:
    """
    Fetch real weather / AQI data from external APIs.
    Falls back to mock data if API keys are missing.
    """
    if MOCK_MODE or not OPENWEATHER_API_KEY:
        return MOCK_SENSOR_DATA.get(pincode, {})

    readings: dict[TriggerType, float] = {}

    async with httpx.AsyncClient(timeout=10) as client:
        # OpenWeatherMap — rainfall & wind
        try:
            resp = await client.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={"q": city, "appid": OPENWEATHER_API_KEY, "units": "metric"},
            )
            data = resp.json()
            rain_mm = data.get("rain", {}).get("1h", 0) * 24  # Extrapolate to daily
            wind_kmh = data.get("wind", {}).get("speed", 0) * 3.6  # m/s → km/h
            readings[TriggerType.HEAVY_RAINFALL] = rain_mm
            readings[TriggerType.CYCLONE] = wind_kmh
        except Exception:
            pass  # Graceful degradation

        # AQI — OpenWeatherMap Air Pollution API
        try:
            geo_resp = await client.get(
                "https://api.openweathermap.org/geo/1.0/direct",
                params={"q": city, "limit": 1, "appid": OPENWEATHER_API_KEY},
            )
            geo = geo_resp.json()
            if geo:
                lat, lon = geo[0]["lat"], geo[0]["lon"]
                aqi_resp = await client.get(
                    "https://api.openweathermap.org/data/2.5/air_pollution",
                    params={"lat": lat, "lon": lon, "appid": OPENWEATHER_API_KEY},
                )
                aqi_data = aqi_resp.json()
                aqi_value = aqi_data["list"][0]["main"]["aqi"] * 100  # Scale approximation
                readings[TriggerType.GRAP_IV] = aqi_value
        except Exception:
            pass

    return readings


@router.post("/check", response_model=list[TriggerEventResponse])
async def check_triggers(req: TriggerCheckRequest):
    """
    Check all parametric triggers for a given city/pincode.
    Returns a list of trigger events where thresholds were breached.
    """
    readings = await _fetch_live_weather(req.city, req.zone_pincode)
    detected: list[TriggerEventResponse] = []

    for trigger_type, threshold_info in TRIGGER_THRESHOLDS.items():
        actual_value = readings.get(trigger_type)
        if actual_value is None:
            continue

        threshold = threshold_info["value"]

        if actual_value >= threshold:
            event_id = str(uuid.uuid4())
            now = datetime.utcnow()

            event = {
                "id": event_id,
                "trigger": trigger_type,
                "zone_pincode": req.zone_pincode,
                "city": req.city,
                "threshold_value": threshold,
                "actual_value": actual_value,
                "data_source": threshold_info["source"],
                "detected_at": now,
            }
            _trigger_events[event_id] = event
            detected.append(TriggerEventResponse(**event))

    return detected


@router.get("/events/{event_id}", response_model=TriggerEventResponse)
async def get_trigger_event(event_id: str):
    """Retrieve a specific trigger event by ID."""
    event = _trigger_events.get(event_id)
    if not event:
        raise HTTPException(404, "Trigger event not found")
    return TriggerEventResponse(**event)
