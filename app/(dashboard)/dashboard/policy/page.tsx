'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getTranslator } from '@/lib/i18n/translations';
import { openRazorpayCheckout, type RazorpaySuccessResponse } from '@/lib/payments/razorpay-checkout';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardPolicy {
  id: string;
  tier: string | null;
  name: string | null;
  premium: number;
  max_payout: number;
  week_start: string;
  week_end: string;
}

interface DashboardProfile {
  full_name: string | null;
  city: string;
  trust_score: number;
}

interface DashboardData {
  profile: DashboardProfile;
  policy: DashboardPolicy | null;
  wallet: { total_earned: number; this_week_earned: number; total_claims: number };
  coins: { balance: number };
  zones: {
    city_zones: ZoneEntry[];
    driver_zones: ZoneEntry[];
  };
  last_tier: string | null;
  next_week_policy: { tier: string | null; name: string | null; premium: number; week_start: string } | null;
  is_sunday_window: boolean;
  next_renewal_date: string | null;
}

interface ZoneContribution {
  zone_id: string;
  zone_name: string;
  risk_score: number;
  time_percentage: number;
  risk_contribution: number;
}

interface UBIDetails {
  ubi_addon: number;
  weighted_risk_score: number;
  risk_level: string;
  zone_contributions: ZoneContribution[];
}

interface PremiumResult {
  city: string;
  date: string;
  tier: string;
  base_premium: number;
  weather_risk_addon: number;
  ubi_addon: number;
  final_premium: number;
  breakdown: {
    prediction_as_of: string;
    rainfall_probability: number;
    wind_probability: number;
    aqi_probability: number;
    combined_risk_score: number;
    city_weights: Record<string, number>;
    aqi_current: number;
    aqi_max_forecast: number;
  };
  ubi_details: UBIDetails;
}

interface DriverZonesData {
  driver_id: string;
  city: string;
  total_trips_last_30_days: number;
  zone_distribution: Array<{
    zone_id: string;
    zone_name: string;
    trips: number;
    percentage: number;
    avg_hours_per_day: number;
    risk_score: number;
    risk_factors: string[];
  }>;
}

interface ZoneEntry {
  zone_id?: string;
  zone_name?: string;
  name?: string;
  risk_score: number;
  risk_factors?: string[];
}

interface CoinActivity {
  id: string;
  activity: string;
  coins: number;
  description: string | null;
  created_at: string;
}

interface CoinsData {
  balance: number;
  history: CoinActivity[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ML_URL = process.env.NEXT_PUBLIC_ML_SERVICE_URL || 'http://localhost:8001';

const CITY_NAMES: Record<string, string> = {
  mumbai: 'Mumbai',
  delhi: 'Delhi',
  bangalore: 'Bangalore',
  chennai: 'Chennai',
  pune: 'Pune',
  hyderabad: 'Hyderabad',
  kolkata: 'Kolkata',
  ahmedabad: 'Ahmedabad',
  jaipur: 'Jaipur',
  lucknow: 'Lucknow',
};

const ACTIVITY_LABELS: Record<string, string> = {
  weekly_login: 'Weekly Login',
  consecutive_weeks: 'Consecutive Weeks Bonus',
  disruption_active: 'Active During Disruption',
  referral: 'Referral Bonus',
  complete_profile: 'Profile Completed',
  clean_claims: 'Clean Claims Streak',
  redeemed_discount: 'Redeemed Discount',
  redeemed_free_week: 'Redeemed Free Week',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + 'T23:59:59');
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function riskColor(value: number): string {
  if (value > 0.7) return 'var(--red-acc)';
  if (value > 0.4) return '#F07820';
  return '#F07820';
}

function riskLabel(value: number): string {
  if (value > 0.7) return 'High';
  if (value > 0.4) return 'Moderate-High';
  if (value > 0.2) return 'Moderate';
  return 'Low';
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div style={{ padding: '20px 16px' }}>
      <style>{`
        @keyframes skeletonPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
        .skel {
          background: var(--ink-10);
          border-radius: 8px;
          animation: skeletonPulse 1.5s ease-in-out infinite;
        }
      `}</style>
      <div className="skel" style={{ width: 120, height: 14, marginBottom: 8 }} />
      <div className="skel" style={{ width: 200, height: 28, marginBottom: 20 }} />
      <div className="skel" style={{ height: 180, marginBottom: 16 }} />
      <div className="skel" style={{ height: 120, marginBottom: 16 }} />
      <div className="skel" style={{ height: 100, marginBottom: 16 }} />
      <div className="skel" style={{ height: 160, marginBottom: 16 }} />
      <div className="skel" style={{ height: 200, marginBottom: 16 }} />
      <div className="skel" style={{ height: 140 }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        border: '1px solid var(--rule)',
        borderRadius: 12,
        padding: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mono"
      style={{
        fontSize: 10,
        color: 'var(--ink-60)',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        marginBottom: 12,
      }}
    >
      {children}
    </p>
  );
}

function ProgressBar({
  value,
  max,
  color,
  height,
}: {
  value: number;
  max: number;
  color: string;
  height?: number;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div
      style={{
        height: height || 6,
        borderRadius: 3,
        background: 'var(--ink-10)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${Math.max(pct, 1)}%`,
          borderRadius: 3,
          background: color,
          transition: 'width 0.5s ease',
        }}
      />
    </div>
  );
}

function CircularGauge({ score }: { score: number }) {
  const pct = Math.min(score * 100, 100);
  const color = riskColor(score);
  const label = riskLabel(score);

  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: `conic-gradient(${color} ${pct * 3.6}deg, var(--ink-10) ${pct * 3.6}deg)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            width: 90,
            height: 90,
            borderRadius: '50%',
            background: 'var(--cream)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            className="serif"
            style={{ fontSize: 22, fontWeight: 900, color: 'var(--ink)' }}
          >
            {score.toFixed(2)}
          </span>
          <span
            className="mono"
            style={{ fontSize: 9, color: 'var(--ink-60)', letterSpacing: '0.05em' }}
          >
            RISK
          </span>
        </div>
      </div>
      <p
        className="sans"
        style={{
          fontSize: 13,
          fontWeight: 600,
          color,
          marginTop: 8,
        }}
      >
        {label} Risk
      </p>
      <p
        className="mono"
        style={{ fontSize: 10, color: 'var(--ink-30)', marginTop: 2 }}
      >
        90-day zone history
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function PolicyPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [premium, setPremium] = useState<PremiumResult | null>(null);
  const [driverZones, setDriverZones] = useState<DriverZonesData | null>(null);
  const [coinsData, setCoinsData] = useState<CoinsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [mlLoaded, setMlLoaded] = useState(false);
  const [userLang, setUserLang] = useState('en');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [windowError, setWindowError] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      // Phase 1: Fast dashboard data
      const dashRes = await fetch('/api/driver/dashboard?fast=1');
      if (!dashRes.ok) throw new Error('Unauthorized');
      const dashData: DashboardData = await dashRes.json();
      if (!dashData.profile) throw new Error('Invalid data');
      setDashboard(dashData);
      setLoading(false);

      const city = dashData.profile.city || 'mumbai';
      const tier = dashData.policy?.tier || 'normal';

      // Phase 2: Parallel fetches for ML data and coins
      const results = await Promise.allSettled([
        // ML premium prediction (with timeout + retry)
        fetch(`${ML_URL}/predict/premium`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ city, tier, driver_id: 'driver_123' }),
          signal: AbortSignal.timeout(15000),
        }).then(async (r) => {
          if (!r.ok) {
            // Retry once after 2 seconds
            await new Promise(res => setTimeout(res, 2000));
            const r2 = await fetch(`${ML_URL}/predict/premium`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ city, tier, driver_id: 'driver_123' }),
              signal: AbortSignal.timeout(15000),
            });
            if (!r2.ok) throw new Error(`HTTP ${r2.status}`);
            return r2.json() as Promise<PremiumResult>;
          }
          return r.json() as Promise<PremiumResult>;
        }),

        // ML driver zones
        fetch(`${ML_URL}/driver/zones`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ city, driver_id: 'driver_123' }),
        }).then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json() as Promise<DriverZonesData>;
        }),

        // Coins + history
        fetch('/api/driver/coins').then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json() as Promise<{ data: CoinsData }>;
        }),

        // Full dashboard (with ML predictions for weather data)
        fetch('/api/driver/dashboard').then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json() as Promise<DashboardData>;
        }),
      ]);

      if (results[0].status === 'fulfilled') {
        setPremium(results[0].value);
      }
      if (results[1].status === 'fulfilled') {
        setDriverZones(results[1].value);
      }
      if (results[2].status === 'fulfilled') {
        const coinsResponse = results[2].value;
        setCoinsData(coinsResponse.data);
      }
      if (results[3].status === 'fulfilled') {
        setDashboard(results[3].value);
      }
      setMlLoaded(true);
    } catch {
      setMlLoaded(true);
      setLoading(false);
      setError(true);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('profiles').select('language').eq('id', user.id).single()
        .then(({ data: p }) => {
          if (p && (p as { language: string }).language) setUserLang((p as { language: string }).language);
        });
    });
  }, []);

  const t = getTranslator(userLang);

  if (loading) return <LoadingSkeleton />;

  if (error || !dashboard) {
    return (
      <div style={{ padding: '60px 16px', textAlign: 'center' }}>
        <p
          className="serif"
          style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}
        >
          {t('policy2.error')}
        </p>
        <p
          className="sans"
          style={{ fontSize: 13, color: 'var(--ink-60)', marginTop: 6 }}
        >
          {t('policy2.errorDesc')}
        </p>
      </div>
    );
  }

  const policy = dashboard.policy;
  const profile = dashboard.profile;
  const cityName = CITY_NAMES[profile.city] || profile.city;
  const tier = (policy?.tier || 'normal') as string;

  // Expiry calculations
  const daysLeft = policy ? daysUntil(policy.week_end) : -1;
  const isExpired = daysLeft < 0;
  const isUrgent = !isExpired && daysLeft <= 3;
  const isReminder = !isExpired && !isUrgent && daysLeft <= 7;

  // Premium breakdown from ML or fallback to policy data
  const basePremium = premium?.base_premium ?? (tier === 'high' ? 160 : tier === 'medium' ? 120 : 80);
  const totalPremium = premium?.final_premium ?? policy?.premium ?? 0;
  // If ML data unavailable, derive addons from total - base
  const mlAvailable = premium != null;
  const weatherAddon = mlAvailable ? (premium?.weather_risk_addon ?? 0) : Math.max(0, Math.round((totalPremium - basePremium) * 0.6));
  const ubiAddon = mlAvailable ? (premium?.ubi_addon ?? 0) : Math.max(0, Math.round((totalPremium - basePremium) * 0.4));

  // Risk data from ML
  const rainfallProb = premium?.breakdown.rainfall_probability ?? 0;
  const windProb = premium?.breakdown.wind_probability ?? 0;
  const aqiProb = premium?.breakdown.aqi_probability ?? 0;
  const combinedRisk = premium?.breakdown.combined_risk_score ?? 0;

  // Zone risk data
  const weightedZoneRisk = premium?.ubi_details.weighted_risk_score ?? 0;
  const zoneContributions = premium?.ubi_details.zone_contributions ?? [];

  // Coins
  const coinBalance = coinsData?.balance ?? dashboard.coins.balance ?? 0;
  const recentActivities = (coinsData?.history ?? []).slice(0, 5);

  // Top driver zones for transparency section
  const topZones = driverZones?.zone_distribution.slice(0, 2) ?? [];

  return (
    <div style={{ padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>
      <h1
        className="serif"
        style={{
          fontSize: 22,
          fontWeight: 900,
          color: 'var(--ink)',
          letterSpacing: '-0.03em',
          marginBottom: 20,
        }}
      >
        {t('policy2.title')}
      </h1>

      {/* Payment Success Banner */}
      {paymentSuccess && (
        <div style={{ marginBottom: 16, padding: '14px 16px', borderRadius: 12, background: 'rgba(34,197,94,0.08)', border: '1px solid #86EFAC' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#16a34a', margin: 0 }}>
            Payment successful! You&apos;re covered for Mon&ndash;Sun next week.
          </p>
          <p style={{ fontSize: 12, color: '#4B5563', margin: '4px 0 0' }}>
            Your policy will be activated automatically on Monday morning.
          </p>
        </div>
      )}

      {!policy ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          {dashboard.next_week_policy ? (
            <>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', background: '#FEF3E8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F07820" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <p className="serif" style={{ fontSize: 18, fontWeight: 700, color: '#F07820' }}>
                Policy Paid — Activates {(() => {
                  const start = new Date(dashboard.next_week_policy!.week_start);
                  const diff = Math.ceil((start.getTime() - Date.now()) / 86400000);
                  return diff <= 1 ? 'Tomorrow' : `in ${diff} days`;
                })()}
              </p>
              <p className="sans" style={{ fontSize: 13, color: 'var(--ink-60)', marginTop: 6 }}>
                {dashboard.next_week_policy.name || dashboard.next_week_policy.tier} plan · ₹{dashboard.next_week_policy.premium}/wk
              </p>
              <p className="sans" style={{ fontSize: 12, color: 'var(--ink-30)', marginTop: 4 }}>
                Starts {new Date(dashboard.next_week_policy.week_start).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
              </p>
            </>
          ) : dashboard.last_tier ? (
            <>
              <p className="serif" style={{ fontSize: 18, fontWeight: 700, color: '#EF4444' }}>
                Policy Inactive
              </p>
              <p className="sans" style={{ fontSize: 13, color: 'var(--ink-60)', marginTop: 6 }}>
                Your {dashboard.last_tier} plan has expired. Reinstate to stay covered.
              </p>
              {windowError && (
                <div style={{
                  background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10,
                  padding: '10px 14px', marginTop: 12, fontSize: 13, color: '#DC2626', textAlign: 'left',
                }}>
                  Payment window is only open on Sundays (6 AM – 11:59 PM IST).
                </div>
              )}
              <button
                onClick={() => {
                  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
                  const isSunday = now.getDay() === 0 && now.getHours() >= 6;
                  if (isSunday) {
                    window.location.href = `/dashboard/policy/reinstate?tier=${dashboard.last_tier}`;
                  } else {
                    setWindowError(true);
                  }
                }}
                style={{
                  display: 'inline-block', marginTop: 16, padding: '10px 24px',
                  borderRadius: 8, background: '#F07820', color: '#fff',
                  fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer',
                }}
              >
                Reinstate Policy
              </button>
            </>
          ) : (
            <>
              <p className="serif" style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>
                No active policy
              </p>
              <p className="sans" style={{ fontSize: 13, color: 'var(--ink-60)', marginTop: 6 }}>
                Subscribe to a plan to get coverage.
              </p>
              <a
                href="/dashboard/policy/purchase"
                style={{
                  display: 'inline-block', marginTop: 16, padding: '10px 24px',
                  borderRadius: 8, background: '#F07820', color: '#fff',
                  fontWeight: 600, fontSize: 14, textDecoration: 'none',
                }}
              >
                Get Covered
              </a>
            </>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* ============================================================== */}
          {/* Section 1: Policy Card                                         */}
          {/* ============================================================== */}
          <SectionCard>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div>
                <p
                  className="mono"
                  style={{ fontSize: 10, color: 'var(--ink-30)', letterSpacing: '0.08em' }}
                >
                  {t('policy2.policyId')}
                </p>
                <p
                  className="mono"
                  style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600, marginTop: 2 }}
                >
                  SS-POL-{policy.id.substring(0, 8).toUpperCase()}
                </p>
              </div>
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: 20,
                  ...(isExpired
                    ? { color: 'var(--red-acc)', border: '1px solid var(--red-acc)' }
                    : { color: '#F07820', border: '1px solid #F07820' }),
                }}
              >
                {isExpired ? t('policy2.expired') : t('policy2.active')}
              </span>
            </div>

            <div style={{ marginTop: 16 }}>
              <p
                className="sans"
                style={{ fontSize: 14, color: 'var(--ink-60)' }}
              >
                {t('policy2.policyHolder')}
              </p>
              <p
                className="serif"
                style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}
              >
                {profile.full_name || 'Driver'}
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                marginTop: 16,
              }}
            >
              <div>
                <p
                  className="mono"
                  style={{ fontSize: 10, color: 'var(--ink-30)', letterSpacing: '0.05em' }}
                >
                  {t('policy2.zoneLbl')}
                </p>
                <p
                  className="sans"
                  style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 500, marginTop: 2 }}
                >
                  {cityName}
                </p>
              </div>
              <div>
                <p
                  className="mono"
                  style={{ fontSize: 10, color: 'var(--ink-30)', letterSpacing: '0.05em' }}
                >
                  {t('policy2.planTier')}
                </p>
                <span
                  className="mono"
                  style={{
                    display: 'inline-block',
                    marginTop: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 4,
                    ...(tier === 'high'
                      ? { color: 'var(--red-acc)', border: '1px solid var(--red-acc)' }
                      : tier === 'medium'
                        ? { color: 'var(--ink-60)', border: '1px solid var(--ink-30)' }
                        : { color: '#F07820', border: '1px solid #F07820' }),
                  }}
                >
                  {tier.toUpperCase()}
                </span>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                marginTop: 12,
              }}
            >
              <div>
                <p
                  className="mono"
                  style={{ fontSize: 10, color: 'var(--ink-30)', letterSpacing: '0.05em' }}
                >
                  {t('policy2.coveragePeriod')}
                </p>
                <p
                  className="sans"
                  style={{ fontSize: 13, color: 'var(--ink)', marginTop: 2 }}
                >
                  {formatDate(policy.week_start)} &ndash; {formatDate(policy.week_end)}
                </p>
              </div>
              <div>
                <p
                  className="mono"
                  style={{ fontSize: 10, color: 'var(--ink-30)', letterSpacing: '0.05em' }}
                >
                  {t('policy2.premium')}
                </p>
                <p
                  className="serif"
                  style={{
                    fontSize: 18,
                    fontWeight: 900,
                    color: 'var(--ink)',
                    marginTop: 2,
                  }}
                >
                  {'\u20B9'}{Number(totalPremium).toFixed(0)}
                  <span
                    className="mono"
                    style={{ fontSize: 11, fontWeight: 400, color: 'var(--ink-30)' }}
                  >
                    {t('policy2.perWeek')}
                  </span>
                </p>
              </div>
            </div>

            <div
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: '1px solid var(--ink-10)',
              }}
            >
              <p
                className="mono"
                style={{ fontSize: 10, color: 'var(--ink-30)', letterSpacing: '0.05em' }}
              >
                {t('policy2.maxPayout')}
              </p>
              <p
                className="serif"
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: '#F07820',
                  marginTop: 2,
                }}
              >
                {'\u20B9'}{Number(policy.max_payout).toLocaleString('en-IN')}
              </p>
            </div>
          </SectionCard>

          {/* ============================================================== */}
          {/* Section 2: Premium Breakdown                                    */}
          {/* ============================================================== */}
          <SectionCard>
            <SectionLabel>{t('policy2.premiumBreakdown')}</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="sans" style={{ fontSize: 14, color: 'var(--ink-60)' }}>
                  {t('policy2.basePremium')} ({tier})
                </span>
                <span className="serif" style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                  {'\u20B9'}{basePremium}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="sans" style={{ fontSize: 14, color: 'var(--ink-60)' }}>
                  {t('policy2.weatherAddon')}
                </span>
                <span className="serif" style={{ fontSize: 14, fontWeight: 600, color: '#F07820' }}>
                  +{'\u20B9'}{weatherAddon.toFixed(2)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="sans" style={{ fontSize: 14, color: 'var(--ink-60)' }}>
                  {t('policy2.ubiAddon')}
                </span>
                <span className="serif" style={{ fontSize: 14, fontWeight: 600, color: '#F07820' }}>
                  +{'\u20B9'}{ubiAddon.toFixed(2)}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: 10,
                  borderTop: '1px solid var(--ink-10)',
                }}
              >
                <span className="sans" style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
                  {t('policy2.total')}
                </span>
                <span className="serif" style={{ fontSize: 18, fontWeight: 900, color: '#F07820' }}>
                  {'\u20B9'}{Number(totalPremium).toFixed(2)}{t('policy2.perWeek')}
                </span>
              </div>
            </div>
          </SectionCard>

          {/* ============================================================== */}
          {/* Section 3: Policy Expiry Reminder                              */}
          {/* ============================================================== */}
          <SectionCard
            style={
              isExpired
                ? { borderColor: 'var(--red-acc)', background: 'rgba(192,57,43,0.04)' }
                : isUrgent
                  ? { borderColor: '#F07820', background: 'rgba(245,158,11,0.04)' }
                  : isReminder
                    ? { borderColor: '#F07820', background: 'rgba(240,120,32,0.03)' }
                    : {}
            }
          >
            <SectionLabel>{t('policy2.coverageStatus')}</SectionLabel>

            {isExpired ? (
              <>
                <p
                  className="sans"
                  style={{ fontSize: 14, fontWeight: 600, color: 'var(--red-acc)' }}
                >
                  {t('policy2.coverageExpired')}
                </p>
                <p
                  className="sans"
                  style={{ fontSize: 13, color: 'var(--ink-60)', marginTop: 4 }}
                >
                  {t('policy2.renewProtected')}
                </p>
              </>
            ) : (isUrgent || isReminder) ? null : (
              <>
                <p
                  className="sans"
                  style={{ fontSize: 14, fontWeight: 500, color: '#F07820' }}
                >
                  {t('policy2.youAreCovered')}
                </p>
                <p
                  className="sans"
                  style={{ fontSize: 13, color: 'var(--ink-60)', marginTop: 4 }}
                >
                  Policy valid until {formatDate(policy.week_end)} ({daysLeft} days remaining).
                </p>
              </>
            )}

            {/* Payment window + renewal info */}
            {(() => {
              const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
              const day = ist.getDay();
              const hour = ist.getHours();
              const isRealWindow = (day === 0 && hour >= 6) || (day === 1 && hour < 6);
              const isPaymentWindow = isRealWindow;

              // Next payment window
              const daysToSunday = day === 0 ? 7 : 7 - day;
              const nextSunday = new Date(ist);
              nextSunday.setDate(ist.getDate() + daysToSunday);
              const nextSundayStr = nextSunday.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });

              // Next Monday (coverage starts)
              const nextMon = new Date(ist);
              const daysToMon = day === 0 ? 1 : 8 - day;
              nextMon.setDate(ist.getDate() + daysToMon);
              const nextMonStr = nextMon.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

              // Next Sunday (coverage ends)
              const coverEnd = new Date(nextMon);
              coverEnd.setDate(nextMon.getDate() + 6);
              const coverEndStr = coverEnd.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

              const dynamicPremium = premium?.final_premium ?? policy?.premium ?? '--';

              if (isPaymentWindow && (isExpired || isUrgent)) {
                // PAYMENT WINDOW IS OPEN — redirect to reinstate page
                return (
                  <div style={{ marginTop: 12, padding: '16px', borderRadius: 12, background: 'linear-gradient(135deg, rgba(240,120,32,0.06), rgba(251,146,60,0.06))', border: '1px solid #FDBA74' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', animation: 'pulse 1.5s ease infinite' }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>Payment window is OPEN</span>
                    </div>
                    <p style={{ fontSize: 13, color: '#4B5563', margin: '0 0 4px' }}>
                      Your next policy will be active from <strong>{nextMonStr} – {coverEndStr}</strong>
                    </p>
                    <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 12px' }}>
                      Premium is calculated dynamically based on your zone, weather risk, and claim history. Window closes Sunday 11:59 PM IST.
                    </p>
                    <a
                      href={`/dashboard/policy/reinstate?tier=${tier}`}
                      style={{ display: 'inline-block', padding: '10px 24px', borderRadius: 10, background: '#F07820', color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}
                    >
                      Reinstate Policy
                    </a>
                  </div>
                );
              }

              if (isExpired || isUrgent) {
                // PAYMENT WINDOW CLOSED — show when it opens next
                return (
                  <div style={{ marginTop: 12, padding: '14px 16px', borderRadius: 12, background: isExpired ? 'rgba(220,38,38,0.04)' : 'rgba(217,119,6,0.04)', border: `1px solid ${isExpired ? '#FCA5A5' : '#FDE68A'}` }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: isExpired ? '#dc2626' : '#d97706', margin: 0 }}>
                      {isExpired ? 'Coverage expired' : 'Coverage expiring soon'}
                    </p>
                    <p style={{ fontSize: 12, color: '#6B7280', margin: '6px 0 0', lineHeight: 1.5 }}>
                      Next payment window opens <strong>{nextSundayStr}, 6:00 AM</strong> and closes Monday 6:00 AM.
                      Pay your premium during this window to get covered for the next week.
                    </p>
                  </div>
                );
              }

              return null;
            })()}
          </SectionCard>

          {/* ============================================================== */}
          {/* Section 4: Rewards Summary                                     */}
          {/* ============================================================== */}
          <SectionCard>
            <SectionLabel>{t('policy2.rewardsSection')}</SectionLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div
                style={{
                  background: 'linear-gradient(135deg, #F97316, #FB923C)',
                  borderRadius: 10,
                  padding: '14px 20px',
                  flex: 1,
                  textAlign: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Coin sparkle animations */}
                <style>{`
                  @keyframes coinFloat1 { 0%,100%{transform:translateY(0) rotate(0deg);opacity:0.6} 50%{transform:translateY(-8px) rotate(15deg);opacity:1} }
                  @keyframes coinFloat2 { 0%,100%{transform:translateY(0) rotate(0deg);opacity:0.4} 50%{transform:translateY(-6px) rotate(-10deg);opacity:0.8} }
                  @keyframes coinShine { 0%{left:-30%} 100%{left:130%} }
                `}</style>
                {/* Floating coin icons */}
                <span style={{ position:'absolute', top:6, left:12, fontSize:16, animation:'coinFloat1 3s ease-in-out infinite', pointerEvents:'none' }}>🪙</span>
                <span style={{ position:'absolute', top:8, right:14, fontSize:14, animation:'coinFloat2 2.5s ease-in-out infinite 0.5s', pointerEvents:'none' }}>🪙</span>
                <span style={{ position:'absolute', bottom:6, left:'40%', fontSize:12, animation:'coinFloat1 4s ease-in-out infinite 1s', pointerEvents:'none' }}>✨</span>
                {/* Shine sweep */}
                <div style={{ position:'absolute', top:0, left:'-30%', width:'20%', height:'100%', background:'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)', animation:'coinShine 3s ease-in-out infinite', pointerEvents:'none' }} />
                <p
                  className="mono"
                  style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.1em', position:'relative', zIndex:1 }}
                >
                  {t('policy2.safeShiftCoins')}
                </p>
                <p
                  className="serif"
                  style={{ fontSize: 28, fontWeight: 900, color: '#fff', marginTop: 2, position:'relative', zIndex:1 }}
                >
                  {Number(coinBalance).toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            {recentActivities.length > 0 && (
              <>
                <p
                  className="mono"
                  style={{
                    fontSize: 10,
                    color: 'var(--ink-30)',
                    letterSpacing: '0.08em',
                    marginBottom: 8,
                  }}
                >
                  {t('policy2.recentActivity')}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {recentActivities.map((entry) => {
                    const date = new Date(entry.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    });
                    const isPositive = entry.coins > 0;
                    return (
                      <div
                        key={entry.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          paddingBottom: 6,
                          borderBottom: '1px solid var(--ink-10)',
                        }}
                      >
                        <div>
                          <p className="sans" style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>
                            {ACTIVITY_LABELS[entry.activity] || entry.activity}
                          </p>
                          <p className="mono" style={{ fontSize: 10, color: 'var(--ink-30)' }}>
                            {date}
                          </p>
                        </div>
                        <span
                          className="serif"
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: isPositive ? '#F07820' : 'var(--red-acc)',
                          }}
                        >
                          {isPositive ? '+' : ''}
                          {entry.coins}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <p
              className="sans"
              style={{ fontSize: 12, color: 'var(--ink-30)', marginTop: 12 }}
            >
              {t('policy2.coinsNote')}
            </p>
          </SectionCard>

          {/* ============================================================== */}
          {/* Section 5: Risk Drivers                                        */}
          {/* ============================================================== */}
          <SectionCard>
            <SectionLabel>{t('policy2.riskDrivers')}</SectionLabel>

            {premium ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Rainfall */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span className="sans" style={{ fontSize: 13, color: 'var(--ink)' }}>
                      {t('policy2.rainfallForecast')}
                    </span>
                    <span
                      className="serif"
                      style={{ fontSize: 13, fontWeight: 600, color: riskColor(rainfallProb) }}
                    >
                      {(rainfallProb * 100).toFixed(1)}%
                    </span>
                  </div>
                  <ProgressBar value={rainfallProb} max={1} color={riskColor(rainfallProb)} />
                </div>

                {/* AQI */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span className="sans" style={{ fontSize: 13, color: 'var(--ink)' }}>
                      {t('policy2.aqiTrend')}
                    </span>
                    <span
                      className="serif"
                      style={{ fontSize: 13, fontWeight: 600, color: riskColor(aqiProb) }}
                    >
                      {(aqiProb * 100).toFixed(1)}%
                    </span>
                  </div>
                  <ProgressBar value={aqiProb} max={1} color={riskColor(aqiProb)} />
                </div>

                {/* Historical / combined risk */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span className="sans" style={{ fontSize: 13, color: 'var(--ink)' }}>
                      {t('policy2.historicalRisk')}
                    </span>
                    <span
                      className="serif"
                      style={{ fontSize: 13, fontWeight: 600, color: riskColor(combinedRisk) }}
                    >
                      {(combinedRisk * 100).toFixed(1)}%
                    </span>
                  </div>
                  <ProgressBar value={combinedRisk} max={1} color={riskColor(combinedRisk)} />
                </div>

                {/* Wind / cyclone */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span className="sans" style={{ fontSize: 13, color: 'var(--ink)' }}>
                      {t('policy2.windRisk')}
                    </span>
                    <span
                      className="serif"
                      style={{ fontSize: 13, fontWeight: 600, color: riskColor(windProb) }}
                    >
                      {(windProb * 100).toFixed(1)}%
                    </span>
                  </div>
                  <ProgressBar value={windProb} max={1} color={riskColor(windProb)} />
                </div>
              </div>
            ) : (
              <p className="sans" style={{ fontSize: 13, color: 'var(--ink-30)', textAlign: 'center', padding: '16px 0' }}>
                {mlLoaded ? 'Risk predictions unavailable — ML service offline' : 'Loading risk predictions...'}
              </p>
            )}
          </SectionCard>

          {/* ============================================================== */}
          {/* Section 6: Zone Risk Assessment                                */}
          {/* ============================================================== */}
          <SectionCard>
            <SectionLabel>{t('policy2.zoneRiskAssessment')}</SectionLabel>

            {premium ? (
              <>
                <CircularGauge score={weightedZoneRisk} />

                <div
                  style={{
                    marginTop: 16,
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 16,
                  }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <p className="mono" style={{ fontSize: 10, color: 'var(--ink-30)' }}>
                      {t('policy2.premiumImpact')}
                    </p>
                    <p className="serif" style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
                      +{'\u20B9'}{ubiAddon.toFixed(2)}
                    </p>
                  </div>
                  <div style={{ width: 1, background: 'var(--rule)' }} />
                  <div style={{ textAlign: 'center' }}>
                    <p className="mono" style={{ fontSize: 10, color: 'var(--ink-30)' }}>
                      {t('policy2.riskLevel')}
                    </p>
                    <p
                      className="sans"
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: riskColor(weightedZoneRisk),
                      }}
                    >
                      {premium.ubi_details.risk_level.toUpperCase()}
                    </p>
                  </div>
                </div>

                {/* Zone breakdown bars */}
                {zoneContributions.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <p
                      className="mono"
                      style={{
                        fontSize: 10,
                        color: 'var(--ink-30)',
                        letterSpacing: '0.08em',
                        marginBottom: 10,
                      }}
                    >
                      {t('policy2.zoneBreakdown')}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {zoneContributions.map((z) => (
                        <div key={z.zone_id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span className="sans" style={{ fontSize: 13, color: 'var(--ink)' }}>
                              {z.zone_name}
                            </span>
                            <span
                              className="serif"
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: riskColor(z.risk_score),
                              }}
                            >
                              {(z.risk_score * 100).toFixed(0)}%
                            </span>
                          </div>
                          <ProgressBar
                            value={z.risk_score}
                            max={1}
                            color={riskColor(z.risk_score)}
                          />
                          <p
                            className="mono"
                            style={{ fontSize: 10, color: 'var(--ink-30)', marginTop: 2 }}
                          >
                            {z.time_percentage}% of trips
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="sans" style={{ fontSize: 13, color: 'var(--ink-30)', textAlign: 'center', padding: '16px 0' }}>
                {mlLoaded ? 'Zone data unavailable — ML service offline' : 'Loading zone risk data...'}
              </p>
            )}
          </SectionCard>

          {/* ============================================================== */}
          {/* Section 7: Premium Transparency                                */}
          {/* ============================================================== */}
          <SectionCard style={{ background: 'var(--cream-d)' }}>
            <SectionLabel>Why is your premium {'\u20B9'}{Number(totalPremium).toFixed(0)} this week?</SectionLabel>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Base rate explanation */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#F07820',
                    marginTop: 6,
                    flexShrink: 0,
                  }}
                />
                <p className="sans" style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>
                  Base rate for{' '}
                  <strong>{tier.charAt(0).toUpperCase() + tier.slice(1)}</strong> tier:{' '}
                  <strong>{'\u20B9'}{basePremium}</strong>
                </p>
              </div>

              {/* Weather explanation */}
              {premium && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: '#F07820',
                      marginTop: 6,
                      flexShrink: 0,
                    }}
                  />
                  <p className="sans" style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>
                    {weatherAddon > 15 ? (
                      <>{cityName} shows elevated disruption risk this week (rainfall {(rainfallProb * 100).toFixed(0)}%, wind {(windProb * 100).toFixed(0)}%, AQI {(aqiProb * 100).toFixed(0)}%) &rarr; +{'\u20B9'}{weatherAddon.toFixed(0)} weather adjustment</>
                    ) : weatherAddon > 10 ? (
                      <>Moderate weather risk detected in {cityName} based on ML forecast &rarr; +{'\u20B9'}{weatherAddon.toFixed(0)} weather adjustment</>
                    ) : (
                      <>Low disruption risk in {cityName} this week. Minimum weather base: +{'\u20B9'}{weatherAddon.toFixed(0)}</>
                    )}
                  </p>
                </div>
              )}

              {/* UBI explanation */}
              {premium && topZones.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--red-acc)',
                      marginTop: 6,
                      flexShrink: 0,
                    }}
                  />
                  <p className="sans" style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>
                    You operate in{' '}
                    {topZones.map((z, i) => (
                      <span key={z.zone_id}>
                        <strong>{z.zone_name}</strong> ({z.risk_score.toFixed(2)} risk)
                        {i < topZones.length - 1 ? ' and ' : ''}
                      </span>
                    ))}{' '}
                    &rarr; +{'\u20B9'}{ubiAddon.toFixed(0)} UBI
                  </p>
                </div>
              )}

              {/* No ML data fallback */}
              {!premium && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--ink-30)',
                      marginTop: 6,
                      flexShrink: 0,
                    }}
                  />
                  <p className="sans" style={{ fontSize: 13, color: 'var(--ink-60)', lineHeight: 1.5 }}>
                    {mlLoaded ? 'Detailed breakdown unavailable — ML service offline.' : 'Detailed breakdown loading... Weather and zone risk data will appear shortly.'}
                  </p>
                </div>
              )}
            </div>

            <div
              style={{
                marginTop: 16,
                paddingTop: 12,
                borderTop: '1px solid var(--rule)',
              }}
            >
              <p
                className="mono"
                style={{ fontSize: 10, color: 'var(--ink-30)', lineHeight: 1.6 }}
              >
                Your premium is calculated using real-time weather forecasts, ML
                predictions, and your zone-based driving patterns. Every factor is
                transparent and fair.
              </p>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
