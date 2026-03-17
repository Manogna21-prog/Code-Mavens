"""
SafeShift — SQLAlchemy ORM models (PostgreSQL)
"""

import uuid
from datetime import datetime, date

from sqlalchemy import (
    Column, String, Boolean, Integer, Float, Date, DateTime,
    Enum, ForeignKey, UniqueConstraint, Index, JSON, create_engine,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

from app.models import Tier, TriggerType, ClaimStatus, PolicyStatus

Base = declarative_base()


def generate_uuid() -> str:
    return str(uuid.uuid4())


class DriverORM(Base):
    __tablename__ = "drivers"

    id = Column(String, primary_key=True, default=generate_uuid)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(15), nullable=False, unique=True)
    aadhaar_hash = Column(String(64), nullable=False, unique=True)
    driving_license = Column(String(20), nullable=False)
    vehicle_rc = Column(String(20), nullable=False)
    vehicle_type = Column(String(50), nullable=False)
    vehicle_chassis_hash = Column(String(64), nullable=False, unique=True)
    upi_id = Column(String(100), nullable=False)
    operating_city = Column(String(50), nullable=False)
    operating_pincode = Column(String(6), nullable=False)
    preferred_language = Column(String(10), default="en")
    coin_balance = Column(Integer, default=0)
    profile_complete = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    policies = relationship("PolicyORM", back_populates="driver")
    claims = relationship("ClaimORM", back_populates="driver")


class PolicyORM(Base):
    __tablename__ = "policies"

    id = Column(String, primary_key=True, default=generate_uuid)
    driver_id = Column(String, ForeignKey("drivers.id"), nullable=False)
    tier = Column(Enum(Tier), nullable=False, default=Tier.NORMAL)
    status = Column(Enum(PolicyStatus), nullable=False, default=PolicyStatus.ACTIVE)
    base_premium = Column(Float, nullable=False)
    weather_risk_adjustment = Column(Float, default=0.0)
    ubi_adjustment = Column(Float, default=0.0)
    final_premium = Column(Float, nullable=False)
    max_weekly_payout = Column(Float, nullable=False)
    week_start = Column(Date, nullable=False)
    week_end = Column(Date, nullable=False)
    total_paid_out_this_week = Column(Float, default=0.0)
    payment_ref = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)

    driver = relationship("DriverORM", back_populates="policies")
    claims = relationship("ClaimORM", back_populates="policy")

    __table_args__ = (
        Index("idx_policies_driver", "driver_id"),
        Index("idx_policies_week", "week_start", "week_end"),
    )


class TriggerEventORM(Base):
    __tablename__ = "trigger_events"

    id = Column(String, primary_key=True, default=generate_uuid)
    trigger = Column(Enum(TriggerType), nullable=False)
    zone_pincode = Column(String(6), nullable=False)
    city = Column(String(50), nullable=False)
    threshold_value = Column(Float, nullable=False)
    actual_value = Column(Float, nullable=False)
    data_source = Column(String(100), nullable=False)
    detected_at = Column(DateTime, default=datetime.utcnow)
    raw_payload = Column(JSON)

    __table_args__ = (
        Index("idx_triggers_zone", "zone_pincode", "detected_at"),
    )


class ClaimORM(Base):
    __tablename__ = "claims"

    id = Column(String, primary_key=True, default=generate_uuid)
    driver_id = Column(String, ForeignKey("drivers.id"), nullable=False)
    policy_id = Column(String, ForeignKey("policies.id"), nullable=False)
    trigger_event_id = Column(String, ForeignKey("trigger_events.id"), nullable=False)
    trigger = Column(Enum(TriggerType), nullable=False)
    status = Column(Enum(ClaimStatus), nullable=False, default=ClaimStatus.PENDING)
    gate1_passed = Column(Boolean, default=False)
    gate1_checked_at = Column(DateTime)
    gate2_passed = Column(Boolean, default=False)
    gate2_checked_at = Column(DateTime)
    driver_app_active_minutes = Column(Integer)
    driver_gps_in_zone = Column(Boolean)
    payout_amount = Column(Float)
    upi_txn_ref = Column(String(100))
    paid_at = Column(DateTime)
    claim_date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    driver = relationship("DriverORM", back_populates="claims")
    policy = relationship("PolicyORM", back_populates="claims")

    __table_args__ = (
        UniqueConstraint("driver_id", "claim_date", name="uq_driver_claim_date"),
        Index("idx_claims_driver", "driver_id"),
        Index("idx_claims_date", "claim_date"),
    )
