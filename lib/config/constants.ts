// ============================================================================
// SafeShift — Master Configuration
// All thresholds, tiers, payout schedules, and business rules
// ============================================================================

// --- Disruption Types ---
export const DISRUPTION_TYPES = [
  'heavy_rainfall',
  'aqi_grap_iv',
  'cyclone',
  'platform_outage',
  'curfew_bandh',
] as const;

export type DisruptionType = (typeof DISRUPTION_TYPES)[number];

// --- Tier Types ---
export const TIER_TYPES = ['normal', 'medium', 'high'] as const;
export type TierType = (typeof TIER_TYPES)[number];

// --- Claim Statuses ---
export const CLAIM_STATUSES = [
  'triggered',
  'gate1_passed',
  'gate2_passed',
  'approved',
  'paid',
  'rejected',
  'pending_review',
  'appealed',
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

// --- Onboarding Steps ---
export const ONBOARDING_STEPS = [
  'registered',
  'language_selected',
  'aadhaar_verified',
  'documents_uploaded',
  'upi_verified',
  'city_selected',
  'tier_selected',
  'payment_done',
  'complete',
] as const;
export type OnboardingStatus = (typeof ONBOARDING_STEPS)[number];

// --- Trigger Thresholds ---
export const TRIGGERS = {
  heavy_rainfall: {
    threshold: 65, // mm/day
    unit: 'mm/day',
    label: 'Heavy Rainfall / Flood',
    description: 'Rainfall exceeds 65mm in a day',
    geofence_radius_km: 15,
    severity_min: 5.0,
    severity_max: 10.0,
    severity_range: [65, 130] as [number, number], // linear interpolation range
  },
  aqi_grap_iv: {
    threshold: 450, // AQI
    unit: 'AQI',
    label: 'GRAP-IV Air Quality',
    description: 'AQI exceeds 450 (GRAP-IV level)',
    geofence_radius_km: 20,
    severity_min: 5.0,
    severity_max: 10.0,
    severity_range: [450, 500] as [number, number],
  },
  cyclone: {
    threshold: 70, // km/h
    unit: 'km/h',
    label: 'Cyclone',
    description: 'Wind speed exceeds 70 km/h',
    geofence_radius_km: 25,
    severity_min: 5.0,
    severity_max: 10.0,
    severity_range: [70, 140] as [number, number],
  },
  platform_outage: {
    threshold: 3, // hours
    unit: 'hours',
    label: 'Platform Outage',
    description: 'Porter platform down for more than 3 hours',
    geofence_radius_km: 0, // affects all in city
    severity_min: 5.0,
    severity_max: 10.0,
    severity_range: [3, 6] as [number, number],
  },
  curfew_bandh: {
    threshold: 4, // hours
    unit: 'hours',
    label: 'Curfew / Bandh',
    description: 'Mobility halt exceeding 4 hours',
    geofence_radius_km: 20,
    severity_min: 5.0,
    severity_max: 10.0,
    severity_range: [4, 12] as [number, number],
  },
} as const;

// --- Plan Packages ---
export interface PlanPackage {
  slug: TierType;
  name: string;
  tier: TierType;
  weekly_premium_inr: number;
  max_weekly_payout_inr: number;
  payout_schedule: Record<DisruptionType, number>;
  sort_order: number;
}

export const PLAN_PACKAGES: PlanPackage[] = [
  {
    slug: 'normal',
    name: 'Normal',
    tier: 'normal',
    weekly_premium_inr: 80,
    max_weekly_payout_inr: 2000,
    payout_schedule: {
      heavy_rainfall: 1000,
      aqi_grap_iv: 1000,
      cyclone: 1200,
      curfew_bandh: 900,
      platform_outage: 500,
    },
    sort_order: 1,
  },
  {
    slug: 'medium',
    name: 'Medium',
    tier: 'medium',
    weekly_premium_inr: 120,
    max_weekly_payout_inr: 3000,
    payout_schedule: {
      heavy_rainfall: 1500,
      aqi_grap_iv: 1500,
      cyclone: 1800,
      curfew_bandh: 1350,
      platform_outage: 750,
    },
    sort_order: 2,
  },
  {
    slug: 'high',
    name: 'High',
    tier: 'high',
    weekly_premium_inr: 160,
    max_weekly_payout_inr: 4000,
    payout_schedule: {
      heavy_rainfall: 2000,
      aqi_grap_iv: 2000,
      cyclone: 2400,
      curfew_bandh: 1800,
      platform_outage: 1000,
    },
    sort_order: 3,
  },
];

// --- Premium Calculation ---
export const PREMIUM = {
  // WeatherRisk addon bounds
  WEATHER_RISK_MIN: 10, // ₹10 minimum addon
  WEATHER_RISK_MAX: 20, // ₹20 maximum addon
  // UBI addon bounds
  UBI_MIN: 0,
  UBI_MAX: 15, // ₹15 maximum addon
  // Floor: premium never goes below base
} as const;

// --- Seasonal Risk Multipliers (Indian context) ---
export const SEASONAL_RISK: Record<number, number> = {
  0: 0.85,  // Jan: low risk
  1: 0.85,  // Feb: low risk
  2: 1.0,   // Mar: transition
  3: 1.15,  // Apr: pre-monsoon heat
  4: 1.25,  // May: heat + pre-monsoon
  5: 1.4,   // Jun: monsoon onset
  6: 1.4,   // Jul: peak monsoon
  7: 1.4,   // Aug: monsoon
  8: 1.3,   // Sep: retreating monsoon
  9: 1.2,   // Oct: cyclone season
  10: 1.15, // Nov: GRAP-IV season (Delhi)
  11: 0.9,  // Dec: winter AQI risk in north
};

// --- Claim Rules ---
export const CLAIM_RULES = {
  MAX_CLAIMS_PER_DAY: 5,  // Increased for demo (production: 1)
  MIN_ACTIVITY_MINUTES: 45, // Gate 2: driver must be online >= 45 min
  ASSET_LOCK_HOURS: 24,     // 24h lifecycle lock per vehicle
  DUPLICATE_EVENT_RADIUS_KM: 30,
  DUPLICATE_EVENT_WINDOW_HOURS: 6,
} as const;

// --- Fraud Detection ---
export const FRAUD = {
  RAPID_CLAIM_THRESHOLD: 3,         // >=3 claims in 24h = flag
  RAPID_CLAIM_WINDOW_HOURS: 24,
  LOCATION_MISMATCH_KM: 50,         // GPS vs IP >50km = flag
  GPS_MAX_ACCURACY_METERS: 100,
  IMPOSSIBLE_TRAVEL_KM: 50,          // >50km in 30min
  IMPOSSIBLE_TRAVEL_MINUTES: 30,
  CLUSTER_THRESHOLD: 10,             // >=10 claims in window = cluster
  CLUSTER_WINDOW_MINUTES: 10,
  // Fraud score routing
  AUTO_APPROVE_THRESHOLD: 0.3,       // <0.3 = auto-approve
  MANUAL_REVIEW_THRESHOLD: 0.7,      // >0.7 = manual review
  // Fraud score weights
  WEIGHTS: {
    duplicate: 0.30,
    rapid_claims: 0.20,
    location_anomaly: 0.25,
    weather_mismatch: 0.15,
    cluster: 0.10,
  },
  // Trust score
  TRUST_SCORE_DEFAULT: 0.50,
  TRUST_SCORE_CLEAN_CLAIM: 0.05,
  TRUST_SCORE_FRAUD_CONFIRMED: -0.20,
  TRUST_SCORE_SIX_MONTH_BONUS: 0.10,
} as const;

// --- Rewards / Coins ---
export const COINS = {
  WEEKLY_LOGIN: 10,
  CONSECUTIVE_WEEKS_4: 50,
  REFERRAL: 100,
  COMPLETE_PROFILE: 20,
  CLEAN_CLAIMS_6_MONTHS: 75,
  // Redemption
  DISCOUNT_RATE: 5,           // 100 coins = ₹5 off
  DISCOUNT_COINS_REQUIRED: 100,
  FREE_WEEK_COINS_REQUIRED: 500,
} as const;

// --- Supported Languages ---
export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'mr', label: 'मराठी' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'te', label: 'తెలుగు' },
] as const;

// --- Adjudicator ---
export const ADJUDICATOR = {
  CRON_INTERVAL_MINUTES: 15,
  MAX_CONCURRENT_TRIGGERS: 5,
} as const;

// --- API Cache TTLs (ms) ---
export const CACHE_TTL = {
  WEATHER: 30 * 60 * 1000,       // 30 min
  AQI: 60 * 60 * 1000,            // 1 hour
  NEWS: 15 * 60 * 1000,           // 15 min
  PLATFORM_STATUS: 5 * 60 * 1000, // 5 min
} as const;
