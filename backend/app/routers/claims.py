"""
SafeShift — Claim Processing Endpoints (Dual-Gate Verification)
"""

import uuid
from datetime import datetime, date

from fastapi import APIRouter, HTTPException

from app.models import (
    ClaimProcessRequest, ClaimResponse, ClaimStatus, TriggerType,
    PAYOUT_MATRIX, TIER_CONFIG,
)

router = APIRouter(prefix="/api/claims", tags=["Claims"])

# In-memory stores for prototyping
_claims: dict[str, dict] = {}

# Import sibling stores (in production these would be DB queries)
from app.routers.policies import _policies
from app.routers.triggers import _trigger_events

# Track daily claim limit: (driver_id, claim_date) → claim_id
_daily_claims: dict[tuple[str, str], str] = {}

# Temporal asset lock: (vehicle_chassis_hash, claim_date) → claim_id
_vehicle_locks: dict[tuple[str, str], str] = {}


# ── Dual-Gate Verification Constants ─────────────────────────────────

GATE2_MIN_ACTIVE_MINUTES = 45  # Driver must be active ≥ 45 minutes


@router.post("/process", response_model=ClaimResponse, status_code=201)
async def process_claim(req: ClaimProcessRequest):
    """
    Dual-gate claim processing:
      Gate 1 — Verify the environmental trigger event exists and is valid.
      Gate 2 — Verify the driver was actively working (≥45 min + GPS in zone).
    If both gates pass, auto-approve and calculate payout by tier.
    """
    # ── Validate references ──────────────────────────────────────────
    policy = _policies.get(req.policy_id)
    if not policy:
        raise HTTPException(404, "Policy not found")

    trigger_event = _trigger_events.get(req.trigger_event_id)
    if not trigger_event:
        raise HTTPException(404, "Trigger event not found")

    today = date.today().isoformat()

    # ── Daily single-claim enforcement ───────────────────────────────
    daily_key = (req.driver_id, today)
    if daily_key in _daily_claims:
        raise HTTPException(
            409, "Only one claim per driver per day is allowed"
        )

    # ── GATE 1: Environmental Trigger Verification ───────────────────
    gate1_passed = trigger_event["actual_value"] >= trigger_event["threshold_value"]
    gate1_time = datetime.utcnow()

    # ── GATE 2: Driver Activity Validation ───────────────────────────
    gate2_passed = (
        req.driver_app_active_minutes >= GATE2_MIN_ACTIVE_MINUTES
        and req.driver_gps_in_zone
    )
    gate2_time = datetime.utcnow()

    # ── Decision Matrix ──────────────────────────────────────────────
    both_passed = gate1_passed and gate2_passed

    payout_amount = 0.0
    status = ClaimStatus.REJECTED

    if both_passed:
        tier = policy["tier"]
        trigger_type = trigger_event["trigger"]
        payout_amount = PAYOUT_MATRIX.get(trigger_type, {}).get(tier, 0)

        # Enforce weekly payout cap
        remaining_cap = policy["max_weekly_payout"] - policy["total_paid_out_this_week"]
        payout_amount = min(payout_amount, remaining_cap)

        if payout_amount > 0:
            status = ClaimStatus.APPROVED
            policy["total_paid_out_this_week"] += payout_amount
        else:
            status = ClaimStatus.REJECTED  # Weekly cap exceeded

    elif gate1_passed:
        status = ClaimStatus.REJECTED  # Gate 2 failed — driver wasn't active

    claim_id = str(uuid.uuid4())
    now = datetime.utcnow()

    claim = {
        "id": claim_id,
        "driver_id": req.driver_id,
        "policy_id": req.policy_id,
        "trigger_event_id": req.trigger_event_id,
        "trigger": trigger_event["trigger"],
        "status": status,
        "gate1_passed": gate1_passed,
        "gate1_checked_at": gate1_time,
        "gate2_passed": gate2_passed,
        "gate2_checked_at": gate2_time,
        "driver_app_active_minutes": req.driver_app_active_minutes,
        "driver_gps_in_zone": req.driver_gps_in_zone,
        "payout_amount": payout_amount if both_passed else None,
        "upi_txn_ref": f"UPI-{uuid.uuid4().hex[:12].upper()}" if status == ClaimStatus.APPROVED else None,
        "claim_date": date.today(),
        "created_at": now,
    }
    _claims[claim_id] = claim
    _daily_claims[daily_key] = claim_id

    return ClaimResponse(**claim)


@router.get("/driver/{driver_id}", response_model=list[ClaimResponse])
async def get_driver_claims(driver_id: str):
    """Retrieve all claims for a driver, newest first."""
    results = [
        ClaimResponse(**c)
        for c in _claims.values()
        if c["driver_id"] == driver_id
    ]
    results.sort(key=lambda c: c.created_at, reverse=True)
    return results
