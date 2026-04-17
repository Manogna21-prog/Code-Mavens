"""
SafeShift ML Prediction Service (FastAPI)

Endpoints:
  POST /predict/rainfall    — P(precipitation > 65mm in 7 days) for a city
  POST /predict/wind        — P(wind > 70km/h in 7 days) for a city
  POST /predict/aqi         — GRAP-IV probability (via AQICN forecast)
  POST /predict/premium     — Full dynamic premium calculation
  GET  /health              — Health check
"""

import os
import json
import warnings
import time
import numpy as np
import pandas as pd
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
warnings.filterwarnings('ignore', message='Unverified HTTPS request')

# Simple in-memory cache for weather data (avoid Open-Meteo 429 rate limits)
_weather_cache: dict = {}
CACHE_TTL_SECONDS = 3600  # 1 hour
import requests
import joblib
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from zones import get_zones_for_city
from mock_porter import get_driver_zones, calculate_ubi_from_zones

app = FastAPI(title="SafeShift ML Service", version="1.2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ======================== Load Models ========================

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")

rainfall_model = joblib.load(os.path.join(MODEL_DIR, "rainfall_model.joblib"))
with open(os.path.join(MODEL_DIR, "rainfall_model_meta.json")) as f:
    rainfall_meta = json.load(f)

wind_model = joblib.load(os.path.join(MODEL_DIR, "wind_model.joblib"))
with open(os.path.join(MODEL_DIR, "wind_model_meta.json")) as f:
    wind_meta = json.load(f)

print(f"✓ Rainfall model loaded ({len(rainfall_meta['feature_columns'])} features)")
print(f"✓ Wind model loaded ({len(wind_meta['feature_columns'])} features)")

# ======================== Cities ========================

CITIES = {
    "mumbai": {"lat": 19.076, "lng": 72.8777},
    "delhi": {"lat": 28.6139, "lng": 77.209},
    "bangalore": {"lat": 12.9716, "lng": 77.5946},
    "chennai": {"lat": 13.0827, "lng": 80.2707},
    "pune": {"lat": 18.5204, "lng": 73.8567},
    "hyderabad": {"lat": 17.385, "lng": 78.4867},
    "kolkata": {"lat": 22.5726, "lng": 88.3639},
    "ahmedabad": {"lat": 23.0225, "lng": 72.5714},
    "jaipur": {"lat": 26.9124, "lng": 75.7873},
    "lucknow": {"lat": 26.8467, "lng": 80.9462},
}

CITY_RISK_WEIGHTS = {
    "mumbai":    {"rainfall": 0.50, "wind": 0.20, "aqi": 0.30},
    "delhi":     {"rainfall": 0.20, "wind": 0.10, "aqi": 0.70},
    "bangalore": {"rainfall": 0.50, "wind": 0.15, "aqi": 0.35},
    "chennai":   {"rainfall": 0.35, "wind": 0.40, "aqi": 0.25},
    "pune":      {"rainfall": 0.50, "wind": 0.15, "aqi": 0.35},
    "hyderabad": {"rainfall": 0.40, "wind": 0.25, "aqi": 0.35},
    "kolkata":   {"rainfall": 0.40, "wind": 0.30, "aqi": 0.30},
    "ahmedabad": {"rainfall": 0.30, "wind": 0.30, "aqi": 0.40},
    "jaipur":    {"rainfall": 0.20, "wind": 0.15, "aqi": 0.65},
    "lucknow":   {"rainfall": 0.25, "wind": 0.10, "aqi": 0.65},
}

TIER_BASE_PREMIUM = {"normal": 80, "medium": 120, "high": 160}

# ======================== Data Fetching ========================

def fetch_recent_weather(lat: float, lng: float, as_of_date: str, days: int = 35) -> pd.DataFrame:
    """
    Fetch daily weather data ending on as_of_date.
    Uses in-memory cache (1 hour TTL) to avoid Open-Meteo 429 rate limits.
    Falls back to progressively earlier dates if archive API doesn't have recent data.
    """
    # Check cache first
    cache_key = f"{lat:.2f}_{lng:.2f}_{as_of_date}_{days}"
    if cache_key in _weather_cache:
        cached_time, cached_df = _weather_cache[cache_key]
        if time.time() - cached_time < CACHE_TTL_SECONDS:
            print(f"[Weather] Cache hit for {cache_key}")
            return cached_df

    end = datetime.strptime(as_of_date, "%Y-%m-%d")

    # Try with the given date, then fall back up to 7 days earlier
    for offset in range(0, 8, 2):
        actual_end = end - timedelta(days=offset)
        start = actual_end - timedelta(days=days)

        url = "https://archive-api.open-meteo.com/v1/archive"
        params = {
            "latitude": lat, "longitude": lng,
            "start_date": start.strftime("%Y-%m-%d"),
            "end_date": actual_end.strftime("%Y-%m-%d"),
            "daily": "precipitation_sum,rain_sum,wind_speed_10m_max,wind_gusts_10m_max,"
                     "temperature_2m_max,temperature_2m_min,temperature_2m_mean,"
                     "relative_humidity_2m_mean,surface_pressure_mean,cloud_cover_mean",
            "timezone": "Asia/Kolkata",
        }

        # Retry with backoff for 429 rate limits
        for attempt in range(3):
            try:
                resp = requests.get(url, params=params, timeout=15, verify=False)
                if resp.status_code == 429:
                    wait = 2 ** (attempt + 1)  # 2s, 4s, 8s
                    print(f"[Weather] Rate limited (429), waiting {wait}s before retry...")
                    import time as _t
                    _t.sleep(wait)
                    continue
                resp.raise_for_status()
                data = resp.json()

                if "daily" not in data or not data["daily"].get("time"):
                    break  # empty response, try earlier date

                df = pd.DataFrame({
                    "date": pd.to_datetime(data["daily"]["time"]),
                    "precipitation_mm": data["daily"]["precipitation_sum"],
                    "rain_mm": data["daily"]["rain_sum"],
                    "wind_speed_max_kmh": data["daily"]["wind_speed_10m_max"],
                    "wind_gusts_max_kmh": data["daily"]["wind_gusts_10m_max"],
                    "temp_max_c": data["daily"]["temperature_2m_max"],
                    "temp_min_c": data["daily"]["temperature_2m_min"],
                    "temp_mean_c": data["daily"]["temperature_2m_mean"],
                    "humidity_mean": data["daily"]["relative_humidity_2m_mean"],
                    "pressure_mean_hpa": data["daily"]["surface_pressure_mean"],
                    "cloud_cover_mean": data["daily"]["cloud_cover_mean"],
                })

                # Cache the result
                _weather_cache[cache_key] = (time.time(), df)
                return df
            except Exception as e:
                if attempt < 2:
                    continue
                print(f"[Weather] Attempt with end_date={actual_end.strftime('%Y-%m-%d')} failed: {e}")
                break

    raise Exception(f"Could not fetch weather data for any date near {as_of_date}")


def fetch_aqi_forecast(lat: float, lng: float) -> dict:
    """Fetch AQI forecast from AQICN API"""
    token = os.environ.get("WAQI_API_TOKEN", "")
    if not token:
        return {"aqi_current": 0, "aqi_max_forecast": 0, "grap_iv_probability": 0}

    try:
        url = f"https://api.waqi.info/feed/geo:{lat};{lng}/?token={token}"
        resp = requests.get(url, timeout=10, verify=False)
        data = resp.json()

        if data.get("status") != "ok":
            return {"aqi_current": 0, "aqi_max_forecast": 0, "grap_iv_probability": 0}

        current_aqi = data["data"]["aqi"]

        forecast = data["data"].get("forecast", {}).get("daily", {})
        pm25_forecast = forecast.get("pm25", [])

        max_forecast_aqi = current_aqi
        if pm25_forecast:
            max_pm25 = max(day.get("max", 0) for day in pm25_forecast)
            if max_pm25 > 350:
                max_forecast_aqi = max(max_forecast_aqi, 400 + (max_pm25 - 350) * 0.5)
            elif max_pm25 > 250:
                max_forecast_aqi = max(max_forecast_aqi, 300 + (max_pm25 - 250))
            elif max_pm25 > 150:
                max_forecast_aqi = max(max_forecast_aqi, 200 + (max_pm25 - 150))

        if max_forecast_aqi > 450:
            grap_iv_prob = 0.9
        elif max_forecast_aqi > 400:
            grap_iv_prob = (max_forecast_aqi - 400) / 100
        elif max_forecast_aqi > 300:
            grap_iv_prob = (max_forecast_aqi - 300) / 500
        else:
            grap_iv_prob = 0.0

        return {
            "aqi_current": current_aqi,
            "aqi_max_forecast": max_forecast_aqi,
            "grap_iv_probability": round(grap_iv_prob, 4),
        }
    except Exception as e:
        print(f"[AQI Forecast] Error: {e}")
        return {"aqi_current": 0, "aqi_max_forecast": 0, "grap_iv_probability": 0}


# ======================== Feature Engineering ========================

def build_features_for_prediction(weather_df: pd.DataFrame, city_slug: str, target_col: str, feature_cols: list) -> np.ndarray:
    """Build feature vector for the latest day using recent weather data"""
    df = weather_df.copy()
    df["city"] = city_slug

    # Temporal features (derived from the actual dates in the data)
    df["month"] = df["date"].dt.month
    df["day_of_year"] = df["date"].dt.dayofyear
    df["week_of_year"] = df["date"].dt.isocalendar().week.astype(int)
    df["is_monsoon"] = df["month"].isin([6, 7, 8, 9]).astype(int)
    df["is_winter"] = df["month"].isin([11, 12, 1, 2]).astype(int)
    df["is_cyclone_season"] = df["month"].isin([10, 11, 4, 5]).astype(int)
    df["month_sin"] = np.sin(2 * np.pi * df["month"] / 12)
    df["month_cos"] = np.cos(2 * np.pi * df["month"] / 12)

    # Lag features
    for lag in [1, 2, 3, 5, 7, 14, 30]:
        df[f"{target_col}_lag_{lag}"] = df[target_col].shift(lag)

    # Rolling features
    for window in [3, 7, 14, 30]:
        df[f"{target_col}_roll_mean_{window}"] = df[target_col].rolling(window, min_periods=1).mean()
        df[f"{target_col}_roll_max_{window}"] = df[target_col].rolling(window, min_periods=1).max()
        df[f"{target_col}_roll_std_{window}"] = df[target_col].rolling(window, min_periods=1).std()

    if "humidity_mean" in df.columns:
        for window in [3, 7]:
            df[f"humidity_roll_mean_{window}"] = df["humidity_mean"].rolling(window, min_periods=1).mean()

    if "pressure_mean_hpa" in df.columns:
        for window in [3, 7]:
            df[f"pressure_roll_mean_{window}"] = df["pressure_mean_hpa"].rolling(window, min_periods=1).mean()
        df["pressure_change_1d"] = df["pressure_mean_hpa"].diff(1)
        df["pressure_change_3d"] = df["pressure_mean_hpa"].diff(3)

    if "temp_mean_c" in df.columns:
        df["temp_change_1d"] = df["temp_mean_c"].diff(1)

    # Wind-specific features
    if "wind_gusts_max_kmh" in df.columns and any("gusts" in c for c in feature_cols):
        for lag in [1, 3, 7]:
            df[f"wind_gusts_lag_{lag}"] = df["wind_gusts_max_kmh"].shift(lag)
        for window in [3, 7, 14]:
            df[f"gusts_roll_max_{window}"] = df["wind_gusts_max_kmh"].rolling(window, min_periods=1).max()
            df[f"gusts_roll_mean_{window}"] = df["wind_gusts_max_kmh"].rolling(window, min_periods=1).mean()

    # City one-hot encoding
    for c in CITIES:
        df[f"city_{c}"] = 1 if c == city_slug else 0

    # Take the latest row
    latest = df.iloc[-1:]

    # Build feature vector matching the training columns
    feature_vector = np.zeros((1, len(feature_cols)))
    for i, col in enumerate(feature_cols):
        if col in latest.columns:
            val = latest[col].values[0]
            feature_vector[0, i] = val if not pd.isna(val) else 0
        else:
            feature_vector[0, i] = 0

    return feature_vector


def resolve_date(date_param: Optional[str]) -> str:
    """Resolve the prediction date — use provided date or default to 3 days ago
    (archive API lags 2-5 days behind real-time)"""
    if date_param:
        try:
            d = datetime.strptime(date_param, "%Y-%m-%d")
            # Clamp to 3 days ago max — archive API doesn't have recent data
            max_date = datetime.now() - timedelta(days=3)
            if d > max_date:
                return max_date.strftime("%Y-%m-%d")
            return date_param
        except ValueError:
            raise HTTPException(400, f"Invalid date format: {date_param}. Use YYYY-MM-DD")
    # Default: 3 days ago (safe for archive API)
    return (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d")


# ======================== API Models ========================

class CityRequest(BaseModel):
    city: str
    date: Optional[str] = None  # YYYY-MM-DD, defaults to today

class PremiumRequest(BaseModel):
    city: str
    tier: str = "normal"
    driver_id: Optional[str] = None  # For UBI zone lookup
    driver_claim_history: int = 0
    date: Optional[str] = None  # YYYY-MM-DD, defaults to today

class DriverZonesRequest(BaseModel):
    city: str
    driver_id: Optional[str] = None

class PredictionResponse(BaseModel):
    city: str
    date: str
    probability: float
    risk_level: str
    details: dict

class PremiumResponse(BaseModel):
    city: str
    date: str
    tier: str
    base_premium: float
    weather_risk_addon: float
    ubi_addon: float
    final_premium: float
    breakdown: dict
    ubi_details: dict


# ======================== Endpoints ========================

@app.get("/health")
def health():
    return {
        "status": "ok",
        "models_loaded": {
            "rainfall": rainfall_model is not None,
            "wind": wind_model is not None,
        },
        "timestamp": datetime.now().isoformat(),
    }


@app.post("/predict/rainfall", response_model=PredictionResponse)
def predict_rainfall(req: CityRequest):
    if req.city not in CITIES:
        raise HTTPException(400, f"Unknown city: {req.city}")

    prediction_date = resolve_date(req.date)
    coords = CITIES[req.city]

    try:
        weather_df = fetch_recent_weather(coords["lat"], coords["lng"], as_of_date=prediction_date, days=35)
    except Exception as e:
        raise HTTPException(500, f"Failed to fetch weather data: {e}")

    features = build_features_for_prediction(
        weather_df, req.city, "precipitation_mm", rainfall_meta["feature_columns"]
    )

    prob = float(rainfall_model.predict_proba(features)[0, 1])
    risk_level = "low" if prob < 0.2 else "medium" if prob < 0.5 else "high"

    return PredictionResponse(
        city=req.city,
        date=prediction_date,
        probability=round(prob, 4),
        risk_level=risk_level,
        details={
            "model": "XGBoost",
            "target": "P(rainfall > 65mm in next 7 days)",
            "prediction_as_of": prediction_date,
            "data_window": f"{(datetime.strptime(prediction_date, '%Y-%m-%d') - timedelta(days=35)).strftime('%Y-%m-%d')} to {prediction_date}",
            "recent_max_rain_mm": float(weather_df["precipitation_mm"].tail(7).max()),
            "recent_avg_rain_mm": float(weather_df["precipitation_mm"].tail(7).mean()),
        },
    )


@app.post("/predict/wind", response_model=PredictionResponse)
def predict_wind(req: CityRequest):
    if req.city not in CITIES:
        raise HTTPException(400, f"Unknown city: {req.city}")

    prediction_date = resolve_date(req.date)
    coords = CITIES[req.city]

    try:
        weather_df = fetch_recent_weather(coords["lat"], coords["lng"], as_of_date=prediction_date, days=35)
    except Exception as e:
        raise HTTPException(500, f"Failed to fetch weather data: {e}")

    features = build_features_for_prediction(
        weather_df, req.city, "wind_speed_max_kmh", wind_meta["feature_columns"]
    )

    raw_prob = float(wind_model.predict_proba(features)[0, 1])
    proxy_threshold = wind_meta["training_threshold"]
    actual_threshold = wind_meta["actual_threshold"]
    scaling_factor = proxy_threshold / actual_threshold
    scaled_prob = min(raw_prob * scaling_factor, 1.0)

    risk_level = "low" if scaled_prob < 0.05 else "medium" if scaled_prob < 0.15 else "high"

    return PredictionResponse(
        city=req.city,
        date=prediction_date,
        probability=round(scaled_prob, 4),
        risk_level=risk_level,
        details={
            "model": "XGBoost",
            "target": "P(wind > 70km/h in next 7 days)",
            "prediction_as_of": prediction_date,
            "raw_probability": round(raw_prob, 4),
            "scaling_factor": round(scaling_factor, 4),
            "recent_max_wind_kmh": float(weather_df["wind_speed_max_kmh"].tail(7).max()),
            "recent_max_gusts_kmh": float(weather_df["wind_gusts_max_kmh"].tail(7).max()),
        },
    )


@app.post("/predict/aqi", response_model=PredictionResponse)
def predict_aqi(req: CityRequest):
    """AQI prediction using AQICN forecast API (no ML model needed)"""
    if req.city not in CITIES:
        raise HTTPException(400, f"Unknown city: {req.city}")

    prediction_date = resolve_date(req.date)
    coords = CITIES[req.city]
    forecast = fetch_aqi_forecast(coords["lat"], coords["lng"])

    prob = forecast["grap_iv_probability"]
    risk_level = "low" if prob < 0.1 else "medium" if prob < 0.4 else "high"

    return PredictionResponse(
        city=req.city,
        date=prediction_date,
        probability=round(prob, 4),
        risk_level=risk_level,
        details={
            "source": "AQICN Forecast API",
            "note": "AQI forecast is always real-time (date param used for context only)",
            "aqi_current": forecast["aqi_current"],
            "aqi_max_forecast": forecast["aqi_max_forecast"],
        },
    )


@app.post("/predict/premium", response_model=PremiumResponse)
def predict_premium(req: PremiumRequest):
    """
    Dynamic premium calculation:
    FinalPremium = BasePremium + WeatherRisk + UBI

    WeatherRisk = weighted combination of rainfall, wind, AQI probabilities
    UBI = adjustment based on driver's claim history
    """
    if req.city not in CITIES:
        raise HTTPException(400, f"Unknown city: {req.city}")
    if req.tier not in TIER_BASE_PREMIUM:
        raise HTTPException(400, f"Unknown tier: {req.tier}")

    prediction_date = resolve_date(req.date)
    coords = CITIES[req.city]
    base = TIER_BASE_PREMIUM[req.tier]

    try:
        weather_df = fetch_recent_weather(coords["lat"], coords["lng"], as_of_date=prediction_date, days=35)
    except Exception as e:
        raise HTTPException(500, f"Weather data error: {e}")

    # Rainfall prediction
    rain_features = build_features_for_prediction(
        weather_df, req.city, "precipitation_mm", rainfall_meta["feature_columns"]
    )
    rain_prob = float(rainfall_model.predict_proba(rain_features)[0, 1])

    # Wind prediction
    wind_features = build_features_for_prediction(
        weather_df, req.city, "wind_speed_max_kmh", wind_meta["feature_columns"]
    )
    wind_raw = float(wind_model.predict_proba(wind_features)[0, 1])
    wind_prob = min(wind_raw * (wind_meta["training_threshold"] / wind_meta["actual_threshold"]), 1.0)

    # AQI forecast
    aqi_forecast = fetch_aqi_forecast(coords["lat"], coords["lng"])
    aqi_prob = aqi_forecast["grap_iv_probability"]

    # Weighted risk score (city-specific weights)
    weights = CITY_RISK_WEIGHTS.get(req.city, {"rainfall": 0.4, "wind": 0.2, "aqi": 0.4})
    combined_risk = (
        weights["rainfall"] * rain_prob +
        weights["wind"] * wind_prob +
        weights["aqi"] * aqi_prob
    )

    # WeatherRisk addon: capped [10, 20]
    weather_risk_addon = 10 + (combined_risk * 10)
    weather_risk_addon = max(10, min(20, weather_risk_addon))

    # Seasonal risk multiplier (Indian weather patterns)
    SEASONAL_MULTIPLIER = {
        1: 0.85, 2: 0.85, 3: 1.0, 4: 1.15, 5: 1.25,
        6: 1.4, 7: 1.4, 8: 1.4, 9: 1.3, 10: 1.2, 11: 1.15, 12: 0.9,
    }
    current_month = datetime.strptime(prediction_date, "%Y-%m-%d").month
    seasonal_mult = SEASONAL_MULTIPLIER.get(current_month, 1.0)
    weather_risk_addon = round(weather_risk_addon * seasonal_mult, 2)
    weather_risk_addon = max(10, min(30, weather_risk_addon))  # expanded cap for monsoon

    # UBI addon: based on driver's zone exposure (from mock Porter API)
    driver_zones = get_driver_zones(req.city, req.driver_id)
    ubi_result = calculate_ubi_from_zones(driver_zones["zone_distribution"])
    ubi_addon = ubi_result["ubi_addon"]

    final_premium = base + weather_risk_addon + ubi_addon

    return PremiumResponse(
        city=req.city,
        date=prediction_date,
        tier=req.tier,
        base_premium=base,
        weather_risk_addon=round(weather_risk_addon, 2),
        ubi_addon=ubi_addon,
        final_premium=round(final_premium, 2),
        breakdown={
            "prediction_as_of": prediction_date,
            "rainfall_probability": round(rain_prob, 4),
            "wind_probability": round(wind_prob, 4),
            "aqi_probability": round(aqi_prob, 4),
            "combined_risk_score": round(combined_risk, 4),
            "city_weights": weights,
            "aqi_current": aqi_forecast["aqi_current"],
            "aqi_max_forecast": aqi_forecast["aqi_max_forecast"],
        },
        ubi_details=ubi_result,
    )


@app.post("/driver/zones")
def get_driver_zones_endpoint(req: DriverZonesRequest):
    """Mock Porter API: Get driver's frequent zones and risk profile"""
    if req.city not in CITIES:
        raise HTTPException(400, f"Unknown city: {req.city}")

    return get_driver_zones(req.city, req.driver_id)


@app.get("/zones/{city}")
def get_city_zones(city: str):
    """Get all zones with risk scores for a city"""
    if city not in CITIES:
        raise HTTPException(400, f"Unknown city: {city}")

    zones = get_zones_for_city(city)
    return {
        "city": city,
        "total_zones": len(zones),
        "zones": zones,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
