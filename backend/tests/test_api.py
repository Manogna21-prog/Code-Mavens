"""
SafeShift — API Integration Tests
Tests core workflows: registration → policy → trigger → claim → pricing
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


# ── Health & Root ─────────────────────────────────────────────────────

class TestHealthCheck:
    def test_health_returns_ok(self):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert data["service"] == "safeshift-api"

    def test_root_returns_info(self):
        resp = client.get("/")
        assert resp.status_code == 200
        assert "SafeShift" in resp.json()["message"]


# ── Driver Registration ──────────────────────────────────────────────

SAMPLE_DRIVER = {
    "full_name": "Rajesh Kumar",
    "phone": "+919876543210",
    "aadhaar_number": "123456789012",
    "driving_license": "DL-1420110012345",
    "vehicle_rc": "DL01AB1234",
    "vehicle_type": "Tata Ace",
    "vehicle_chassis_number": "MA1TBA2EXKE000001",
    "upi_id": "rajesh@upi",
    "operating_city": "delhi-ncr",
    "operating_pincode": "110001",
    "preferred_language": "hi",
}


class TestDriverRegistration:
    def test_register_driver_success(self):
        resp = client.post("/api/drivers/register", json=SAMPLE_DRIVER)
        assert resp.status_code == 201
        data = resp.json()
        assert data["full_name"] == "Rajesh Kumar"
        assert data["phone"] == "+919876543210"
        assert data["vehicle_type"] == "Tata Ace"
        assert data["operating_city"] == "delhi-ncr"
        assert data["coin_balance"] == 0
        assert data["profile_complete"] is True
        assert "id" in data

    def test_register_duplicate_phone_rejected(self):
        # Register a second driver with a unique phone first
        driver2 = {**SAMPLE_DRIVER, "phone": "+919999999999",
                    "aadhaar_number": "999999999999",
                    "vehicle_chassis_number": "UNIQUE_CHASSIS_001"}
        client.post("/api/drivers/register", json=driver2)
        # Try same phone again
        resp = client.post("/api/drivers/register", json=driver2)
        assert resp.status_code == 400

    def test_get_driver_not_found(self):
        resp = client.get("/api/drivers/nonexistent-id-123")
        assert resp.status_code == 404


# ── Policy Management ────────────────────────────────────────────────

class TestPolicyManagement:
    def _create_driver(self):
        import uuid
        driver = {**SAMPLE_DRIVER,
                  "phone": f"+91{uuid.uuid4().hex[:10]}",
                  "aadhaar_number": uuid.uuid4().hex[:12],
                  "vehicle_chassis_number": uuid.uuid4().hex}
        resp = client.post("/api/drivers/register", json=driver)
        return resp.json()["id"]

    def test_create_policy_normal_tier(self):
        driver_id = self._create_driver()
        resp = client.post("/api/policies", json={
            "driver_id": driver_id,
            "tier": "normal",
            "week_start": "2026-03-16",
            "week_end": "2026-03-22",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["tier"] == "normal"
        assert data["base_premium"] == 80.0
        assert data["final_premium"] == 80.0
        assert data["max_weekly_payout"] == 2000.0
        assert data["status"] == "active"

    def test_create_policy_high_tier(self):
        driver_id = self._create_driver()
        resp = client.post("/api/policies", json={
            "driver_id": driver_id,
            "tier": "high",
            "week_start": "2026-03-16",
            "week_end": "2026-03-22",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["base_premium"] == 160.0
        assert data["max_weekly_payout"] == 4000.0

    def test_renew_policy(self):
        driver_id = self._create_driver()
        # Create initial policy
        resp1 = client.post("/api/policies", json={
            "driver_id": driver_id,
            "tier": "medium",
            "week_start": "2026-03-16",
            "week_end": "2026-03-22",
        })
        policy_id = resp1.json()["id"]

        # Renew
        resp2 = client.post(f"/api/policies/{policy_id}/renew")
        assert resp2.status_code == 200
        data = resp2.json()
        assert data["week_start"] == "2026-03-23"
        assert data["week_end"] == "2026-03-29"
        assert data["status"] == "active"


# ── Trigger Detection ────────────────────────────────────────────────

class TestTriggerDetection:
    def test_delhi_grap_iv_triggers(self):
        """Delhi pincode 110001 has mock AQI=480 > threshold 450."""
        resp = client.post("/api/triggers/check", json={
            "city": "delhi",
            "zone_pincode": "110001",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        grap = [t for t in data if t["trigger"] == "grap_iv"]
        assert len(grap) == 1
        assert grap[0]["actual_value"] == 480.0
        assert grap[0]["threshold_value"] == 450

    def test_mumbai_rainfall_triggers(self):
        """Mumbai pincode 400001 has mock rainfall=85mm > threshold 65mm."""
        resp = client.post("/api/triggers/check", json={
            "city": "mumbai",
            "zone_pincode": "400001",
        })
        data = resp.json()
        rainfall = [t for t in data if t["trigger"] == "heavy_rainfall"]
        assert len(rainfall) == 1
        assert rainfall[0]["actual_value"] == 85.0

    def test_bangalore_no_triggers(self):
        """Bangalore pincode 560001 — all values below thresholds."""
        resp = client.post("/api/triggers/check", json={
            "city": "bangalore",
            "zone_pincode": "560001",
        })
        data = resp.json()
        assert len(data) == 0

    def test_unknown_pincode_no_triggers(self):
        resp = client.post("/api/triggers/check", json={
            "city": "kolkata",
            "zone_pincode": "700001",
        })
        assert resp.status_code == 200
        assert resp.json() == []


# ── Dynamic Pricing ──────────────────────────────────────────────────

class TestDynamicPricing:
    def test_base_premium_normal(self):
        resp = client.post("/api/pricing/calculate", json={
            "city": "delhi-ncr",
            "tier": "normal",
            "weather_risk_level": "normal",
            "ubi_score": 0.0,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["base_premium"] == 80.0
        assert data["weather_risk_adjustment"] == 0.0
        assert data["ubi_adjustment"] == 0.0
        assert data["final_premium"] == 80.0

    def test_weather_risk_moderate(self):
        resp = client.post("/api/pricing/calculate", json={
            "city": "mumbai",
            "tier": "normal",
            "weather_risk_level": "moderate",
            "ubi_score": 0.0,
        })
        data = resp.json()
        assert data["weather_risk_adjustment"] == 10.0
        assert data["final_premium"] == 90.0

    def test_ubi_high_risk_zone(self):
        resp = client.post("/api/pricing/calculate", json={
            "city": "delhi-ncr",
            "tier": "medium",
            "weather_risk_level": "normal",
            "ubi_score": 0.25,
        })
        data = resp.json()
        assert data["base_premium"] == 120.0
        assert data["ubi_adjustment"] == 10.0
        assert data["final_premium"] == 130.0

    def test_full_adjustment_high_tier(self):
        """High tier + high weather + high UBI = max premium."""
        resp = client.post("/api/pricing/calculate", json={
            "city": "chennai",
            "tier": "high",
            "weather_risk_level": "high",
            "ubi_score": 0.35,
        })
        data = resp.json()
        assert data["base_premium"] == 160.0
        assert data["weather_risk_adjustment"] == 20.0
        assert data["ubi_adjustment"] == 15.0
        assert data["final_premium"] == 195.0

    def test_breakdown_string_present(self):
        resp = client.post("/api/pricing/calculate", json={
            "city": "delhi-ncr",
            "tier": "normal",
            "weather_risk_level": "normal",
            "ubi_score": 0.0,
        })
        data = resp.json()
        assert "Base" in data["breakdown"]
        assert "Weather" in data["breakdown"]
        assert "UBI" in data["breakdown"]
