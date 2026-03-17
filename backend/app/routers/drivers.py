"""
SafeShift — Driver Registration & Profile Endpoints
"""

import hashlib
import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.models import DriverRegisterRequest, DriverResponse

router = APIRouter(prefix="/api/drivers", tags=["Drivers"])

# In-memory store for prototyping (replace with PostgreSQL via SQLAlchemy)
_drivers: dict[str, dict] = {}


def _hash(value: str) -> str:
    """SHA-256 hash for sensitive fields (Aadhaar, chassis number)."""
    return hashlib.sha256(value.encode()).hexdigest()


@router.post("/register", response_model=DriverResponse, status_code=201)
async def register_driver(req: DriverRegisterRequest):
    """
    Register a new LCV delivery partner.
    Accepts Aadhaar (hashed before storage), vehicle details, UPI ID, and city.
    """
    # Check for duplicate phone
    for d in _drivers.values():
        if d["phone"] == req.phone:
            raise HTTPException(400, "Phone number already registered")

    driver_id = str(uuid.uuid4())
    now = datetime.utcnow()

    driver = {
        "id": driver_id,
        "full_name": req.full_name,
        "phone": req.phone,
        "aadhaar_hash": _hash(req.aadhaar_number),
        "driving_license": req.driving_license,
        "vehicle_rc": req.vehicle_rc,
        "vehicle_type": req.vehicle_type,
        "vehicle_chassis_hash": _hash(req.vehicle_chassis_number),
        "upi_id": req.upi_id,
        "operating_city": req.operating_city,
        "operating_pincode": req.operating_pincode,
        "preferred_language": req.preferred_language,
        "coin_balance": 0,
        "profile_complete": True,
        "created_at": now,
    }
    _drivers[driver_id] = driver

    return DriverResponse(**driver)


@router.get("/{driver_id}", response_model=DriverResponse)
async def get_driver(driver_id: str):
    """Retrieve driver profile by ID."""
    driver = _drivers.get(driver_id)
    if not driver:
        raise HTTPException(404, "Driver not found")
    return DriverResponse(**driver)
