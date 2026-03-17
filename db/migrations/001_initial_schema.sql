-- SafeShift: Initial Database Schema
-- Parametric Income Insurance for LCV Delivery Partners

-- Enums
CREATE TYPE tier_type AS ENUM ('normal', 'medium', 'high');
CREATE TYPE trigger_type AS ENUM ('grap_iv', 'heavy_rainfall', 'cyclone', 'app_outage', 'curfew_bandh');
CREATE TYPE claim_status AS ENUM ('pending', 'gate1_passed', 'gate2_passed', 'approved', 'rejected', 'paid');
CREATE TYPE policy_status AS ENUM ('active', 'expired', 'paused', 'cancelled');

-- Drivers table
CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(15) NOT NULL UNIQUE,
    aadhaar_hash VARCHAR(64) NOT NULL UNIQUE,       -- SHA-256 hash of Aadhaar number
    driving_license VARCHAR(20) NOT NULL,
    vehicle_rc VARCHAR(20) NOT NULL,
    vehicle_type VARCHAR(50) NOT NULL,               -- e.g. 'Tata Ace', 'Mahindra Bolero Pickup'
    vehicle_chassis_hash VARCHAR(64) NOT NULL UNIQUE, -- Used for temporal asset locking
    upi_id VARCHAR(100) NOT NULL,
    operating_city VARCHAR(50) NOT NULL,              -- e.g. 'delhi-ncr', 'mumbai', 'bangalore'
    operating_pincode VARCHAR(6) NOT NULL,
    preferred_language VARCHAR(10) DEFAULT 'en',      -- hi, mr, ta, te, en
    coin_balance INT DEFAULT 0,
    profile_complete BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Policies table
CREATE TABLE policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES drivers(id),
    tier tier_type NOT NULL DEFAULT 'normal',
    status policy_status NOT NULL DEFAULT 'active',
    base_premium DECIMAL(10, 2) NOT NULL,            -- ₹80 / ₹120 / ₹160
    weather_risk_adjustment DECIMAL(10, 2) DEFAULT 0,
    ubi_adjustment DECIMAL(10, 2) DEFAULT 0,
    final_premium DECIMAL(10, 2) NOT NULL,
    max_weekly_payout DECIMAL(10, 2) NOT NULL,       -- ₹2000 / ₹3000 / ₹4000
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    total_paid_out_this_week DECIMAL(10, 2) DEFAULT 0,
    payment_ref VARCHAR(100),                         -- Razorpay payment reference
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_policies_driver ON policies(driver_id);
CREATE INDEX idx_policies_week ON policies(week_start, week_end);

-- Trigger events detected by the monitoring system
CREATE TABLE trigger_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trigger trigger_type NOT NULL,
    zone_pincode VARCHAR(6) NOT NULL,
    city VARCHAR(50) NOT NULL,
    threshold_value DECIMAL(10, 2) NOT NULL,          -- What the threshold is (e.g. 450 for AQI)
    actual_value DECIMAL(10, 2) NOT NULL,             -- What was actually observed
    data_source VARCHAR(100) NOT NULL,                -- e.g. 'cpcb_api', 'openweathermap'
    detected_at TIMESTAMP NOT NULL DEFAULT NOW(),
    raw_payload JSONB                                 -- Raw API response stored for audit
);

CREATE INDEX idx_triggers_zone ON trigger_events(zone_pincode, detected_at);

-- Claims table
CREATE TABLE claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES drivers(id),
    policy_id UUID NOT NULL REFERENCES policies(id),
    trigger_event_id UUID NOT NULL REFERENCES trigger_events(id),
    trigger trigger_type NOT NULL,
    status claim_status NOT NULL DEFAULT 'pending',
    gate1_passed BOOLEAN DEFAULT FALSE,
    gate1_checked_at TIMESTAMP,
    gate2_passed BOOLEAN DEFAULT FALSE,
    gate2_checked_at TIMESTAMP,
    driver_app_active_minutes INT,                    -- Minutes driver was active during disruption
    driver_gps_in_zone BOOLEAN,
    payout_amount DECIMAL(10, 2),
    upi_txn_ref VARCHAR(100),                         -- UPI transaction reference
    paid_at TIMESTAMP,
    claim_date DATE NOT NULL,                          -- For daily single-claim enforcement
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(driver_id, claim_date)                     -- Only one claim per driver per day
);

CREATE INDEX idx_claims_driver ON claims(driver_id);
CREATE INDEX idx_claims_date ON claims(claim_date);

-- Vehicle claim lock (temporal asset locking for fraud prevention)
CREATE TABLE vehicle_claim_locks (
    vehicle_chassis_hash VARCHAR(64) NOT NULL,
    claim_date DATE NOT NULL,
    claim_id UUID NOT NULL REFERENCES claims(id),
    locked_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (vehicle_chassis_hash, claim_date)
);
