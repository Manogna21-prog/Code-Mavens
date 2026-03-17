"""
SafeShift — Policy Management Endpoints
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.models import (
    PolicyCreateRequest, PolicyResponse, PolicyStatus,
    TIER_CONFIG, Tier,
)

router = APIRouter(prefix="/api/policies", tags=["Policies"])

# In-memory store for prototyping
_policies: dict[str, dict] = {}


@router.post("", response_model=PolicyResponse, status_code=201)
async def create_policy(req: PolicyCreateRequest):
    """
    Create a new weekly policy for a driver.
    Premium = BasePremium (from tier). Weather-risk and UBI adjustments
    are applied by calling the pricing service (stubbed for now).
    """
    tier_cfg = TIER_CONFIG[req.tier]

    policy_id = str(uuid.uuid4())
    now = datetime.utcnow()

    policy = {
        "id": policy_id,
        "driver_id": req.driver_id,
        "tier": req.tier,
        "status": PolicyStatus.ACTIVE,
        "base_premium": tier_cfg["base_premium"],
        "weather_risk_adjustment": 0.0,
        "ubi_adjustment": 0.0,
        "final_premium": tier_cfg["base_premium"],  # Will be enriched by pricing service
        "max_weekly_payout": tier_cfg["max_weekly_payout"],
        "week_start": req.week_start,
        "week_end": req.week_end,
        "total_paid_out_this_week": 0.0,
        "created_at": now,
    }
    _policies[policy_id] = policy

    return PolicyResponse(**policy)


@router.get("/{policy_id}", response_model=PolicyResponse)
async def get_policy(policy_id: str):
    """Retrieve a policy by ID."""
    policy = _policies.get(policy_id)
    if not policy:
        raise HTTPException(404, "Policy not found")
    return PolicyResponse(**policy)


@router.post("/{policy_id}/renew", response_model=PolicyResponse)
async def renew_policy(policy_id: str):
    """
    Renew an existing policy for the next week.
    Creates a new policy record with the same tier and driver.
    """
    existing = _policies.get(policy_id)
    if not existing:
        raise HTTPException(404, "Policy not found")

    # Mark old policy as expired
    existing["status"] = PolicyStatus.EXPIRED

    from datetime import timedelta
    new_start = existing["week_end"] + timedelta(days=1)
    new_end = new_start + timedelta(days=6)

    tier_cfg = TIER_CONFIG[existing["tier"]]
    new_id = str(uuid.uuid4())
    now = datetime.utcnow()

    new_policy = {
        "id": new_id,
        "driver_id": existing["driver_id"],
        "tier": existing["tier"],
        "status": PolicyStatus.ACTIVE,
        "base_premium": tier_cfg["base_premium"],
        "weather_risk_adjustment": 0.0,
        "ubi_adjustment": 0.0,
        "final_premium": tier_cfg["base_premium"],
        "max_weekly_payout": tier_cfg["max_weekly_payout"],
        "week_start": new_start,
        "week_end": new_end,
        "total_paid_out_this_week": 0.0,
        "created_at": now,
    }
    _policies[new_id] = new_policy

    return PolicyResponse(**new_policy)
