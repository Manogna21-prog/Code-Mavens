"""
SafeShift — Data Models & Domain Constants
Parametric Income Insurance for LCV Delivery Partners
"""

from __future__ import annotations

import enum
from datetime import datetime, date
from typing import Optional

from pydantic import BaseModel, Field


# ── Enums ────────────────────────────────────────────────────────────

class Tier(str, enum.Enum):
    NORMAL = "normal"
    MEDIUM = "medium"
    HIGH = "high"


class TriggerType(str, enum.Enum):
    GRAP_IV = "grap_iv"
    HEAVY_RAINFALL = "heavy_rainfall"
    CYCLONE = "cyclone"
    APP_OUTAGE = "app_outage"
    CURFEW_BANDH = "curfew_bandh"


class ClaimStatus(str, enum.Enum):
    PENDING = "pending"
    GATE1_PASSED = "gate1_passed"
    GATE2_PASSED = "gate2_passed"
    APPROVED = "approved"
    REJECTED = "rejected"
    PAID = "paid"


class PolicyStatus(str, enum.Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    PAUSED = "paused"
    CANCELLED = "cancelled"


# ── Domain Constants (from README) ───────────────────────────────────

# Tier configuration — base premium (₹/week) and max weekly payout
TIER_CONFIG: dict[Tier, dict] = {
    Tier.NORMAL: {"base_premium": 80.0, "max_weekly_payout": 2000.0},
    Tier.MEDIUM: {"base_premium": 120.0, "max_weekly_payout": 3000.0},
    Tier.HIGH:   {"base_premium": 160.0, "max_weekly_payout": 4000.0},
}

# Parametric trigger thresholds
TRIGGER_THRESHOLDS: dict[TriggerType, dict] = {
    TriggerType.GRAP_IV:       {"value": 450,  "unit": "AQI",    "source": "CPCB API"},
    TriggerType.HEAVY_RAINFALL: {"value": 65,   "unit": "mm/day", "source": "OpenWeatherMap + IMD"},
    TriggerType.CYCLONE:        {"value": 70,   "unit": "km/h",   "source": "Open-Meteo + IMD"},
    TriggerType.APP_OUTAGE:     {"value": 3,    "unit": "hours",  "source": "StatusGator / Platform API"},
    TriggerType.CURFEW_BANDH:   {"value": 4,    "unit": "hours",  "source": "News Scraper"},
}

# Per-disruption payout matrix (₹) — trigger → tier → payout amount
PAYOUT_MATRIX: dict[TriggerType, dict[Tier, float]] = {
    TriggerType.HEAVY_RAINFALL: {Tier.NORMAL: 1000, Tier.MEDIUM: 1500, Tier.HIGH: 2000},
    TriggerType.GRAP_IV:        {Tier.NORMAL: 1000, Tier.MEDIUM: 1500, Tier.HIGH: 2000},
    TriggerType.CYCLONE:         {Tier.NORMAL: 1200, Tier.MEDIUM: 1800, Tier.HIGH: 2400},
    TriggerType.CURFEW_BANDH:    {Tier.NORMAL: 900,  Tier.MEDIUM: 1350, Tier.HIGH: 1800},
    TriggerType.APP_OUTAGE:      {Tier.NORMAL: 500,  Tier.MEDIUM: 750,  Tier.HIGH: 1000},
}

# Weather-risk premium adjustments
WEATHER_RISK_ADJUSTMENTS = {
    "normal":   0.0,
    "moderate": 10.0,
    "high":     20.0,
}

# UBI score → premium adjustment (₹)
UBI_ADJUSTMENTS: list[tuple[float, float, float]] = [
    # (min_score, max_score, adjustment)
    (0.00, 0.10, 0.0),
    (0.10, 0.20, 5.0),
    (0.20, 0.30, 10.0),
    (0.30, 1.00, 15.0),
]


# ── Request / Response Schemas ───────────────────────────────────────

# --- Drivers ---

class DriverRegisterRequest(BaseModel):
    full_name: str
    phone: str
    aadhaar_number: str = Field(description="Raw Aadhaar — hashed before storage")
    driving_license: str
    vehicle_rc: str
    vehicle_type: str
    vehicle_chassis_number: str
    upi_id: str
    operating_city: str
    operating_pincode: str
    preferred_language: str = "en"


class DriverResponse(BaseModel):
    id: str
    full_name: str
    phone: str
    driving_license: str
    vehicle_rc: str
    vehicle_type: str
    upi_id: str
    operating_city: str
    operating_pincode: str
    preferred_language: str
    coin_balance: int
    profile_complete: bool
    created_at: datetime


# --- Policies ---

class PolicyCreateRequest(BaseModel):
    driver_id: str
    tier: Tier
    week_start: date
    week_end: date


class PolicyResponse(BaseModel):
    id: str
    driver_id: str
    tier: Tier
    status: PolicyStatus
    base_premium: float
    weather_risk_adjustment: float
    ubi_adjustment: float
    final_premium: float
    max_weekly_payout: float
    week_start: date
    week_end: date
    total_paid_out_this_week: float
    created_at: datetime


# --- Claims ---

class ClaimProcessRequest(BaseModel):
    driver_id: str
    policy_id: str
    trigger_event_id: str
    driver_app_active_minutes: int = Field(ge=0)
    driver_gps_in_zone: bool


class ClaimResponse(BaseModel):
    id: str
    driver_id: str
    policy_id: str
    trigger_event_id: str
    trigger: TriggerType
    status: ClaimStatus
    gate1_passed: bool
    gate2_passed: bool
    driver_app_active_minutes: int
    driver_gps_in_zone: bool
    payout_amount: Optional[float] = None
    upi_txn_ref: Optional[str] = None
    claim_date: date
    created_at: datetime


# --- Trigger Events ---

class TriggerCheckRequest(BaseModel):
    city: str
    zone_pincode: str


class TriggerEventResponse(BaseModel):
    id: str
    trigger: TriggerType
    zone_pincode: str
    city: str
    threshold_value: float
    actual_value: float
    data_source: str
    detected_at: datetime


# --- Pricing ---

class PricingRequest(BaseModel):
    city: str
    tier: Tier
    weather_risk_level: str = "normal"   # normal / moderate / high
    ubi_score: float = 0.0               # 0.0 – 1.0


class PricingResponse(BaseModel):
    base_premium: float
    weather_risk_adjustment: float
    ubi_adjustment: float
    final_premium: float
    tier: Tier
    breakdown: str
