"""
SafeShift — Dynamic Pricing Endpoint
Implements: FinalPremium = BasePremium + WeatherRisk + UBI
"""

from fastapi import APIRouter

from app.models import (
    PricingRequest, PricingResponse,
    TIER_CONFIG, WEATHER_RISK_ADJUSTMENTS, UBI_ADJUSTMENTS,
)

router = APIRouter(prefix="/api/pricing", tags=["Pricing"])


def _compute_ubi_adjustment(ubi_score: float) -> float:
    """
    Convert UBI risk score (0.0–1.0) to premium adjustment (₹).
    Based on driver's 30-day GPS zone exposure history.
    """
    for min_score, max_score, adjustment in UBI_ADJUSTMENTS:
        if min_score <= ubi_score < max_score:
            return adjustment
    # Score ≥ 0.30 — highest bracket
    return UBI_ADJUSTMENTS[-1][2]


@router.post("/calculate", response_model=PricingResponse)
async def calculate_premium(req: PricingRequest):
    """
    Calculate the dynamic weekly premium for a driver.

    Formula:  FinalPremium = BasePremium + WeatherRisk + UBI
    - WeatherRisk ≥ 0  (premium only increases for risk)
    - UBI ≥ 0           (high-risk-zone drivers pay more)
    - Floor = BasePremium (premium never goes below base)
    """
    tier_cfg = TIER_CONFIG[req.tier]
    base = tier_cfg["base_premium"]

    weather_adj = WEATHER_RISK_ADJUSTMENTS.get(req.weather_risk_level, 0.0)
    ubi_adj = _compute_ubi_adjustment(req.ubi_score)

    final = base + weather_adj + ubi_adj

    breakdown = (
        f"Base(₹{base:.0f}) + Weather(₹{weather_adj:.0f}) + UBI(₹{ubi_adj:.0f}) "
        f"= ₹{final:.0f}/week"
    )

    return PricingResponse(
        base_premium=base,
        weather_risk_adjustment=weather_adj,
        ubi_adjustment=ubi_adj,
        final_premium=final,
        tier=req.tier,
        breakdown=breakdown,
    )
