'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Moon, Bell, ChevronRight, CloudRain, Thermometer, Wind,
  TrendingUp, Award, Shield,
  Flame, BellRing, ClipboardCheck, CreditCard, Users, Headphones,
  Check, Phone, Users2,
  AlertTriangle, HeartPulse, Sun, Cloud, CloudDrizzle, MessageCircle,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface Profile { full_name: string | null; city: string; trust_score: number; }
interface Policy  { tier: string | null; name: string | null; premium: number; max_payout: number; week_start: string; week_end: string; }
interface Weather  { current_temp: number | null; current_rain_mm: number | null; current_aqi: number; current_wind: number | null; }
interface Prediction { probability: number; risk_level: string; }
interface ForecastDay { date: string; day_name: string; temp_max: number; temp_min: number; rain_mm: number; wind_kmh: number; aqi: number; }
interface AlertRow { id: string; event_type: string; severity_score: number; city: string; trigger_value: number | null; created_at: string; }
interface ZoneEntry { zone_id?: string; zone_name?: string; name?: string; risk_score: number; }

interface DashboardData {
  profile: Profile;
  policy: Policy | null;
  weather: Weather;
  predictions: { rainfall: Prediction | null; wind: Prediction | null; aqi: Prediction | null; };
  forecast: ForecastDay[];
  alerts: AlertRow[];
  zones: { city_zones: ZoneEntry[]; driver_zones: ZoneEntry[]; };
  wallet: { total_earned: number; this_week_earned: number; total_claims: number; };
  coins: { balance: number; };
  streak: number;
  zone_status: 'safe' | 'alert' | 'danger';
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const CITY_NAMES: Record<string, string> = {
  mumbai: 'Mumbai', delhi: 'Delhi', bangalore: 'Bangalore', chennai: 'Chennai',
  pune: 'Pune', hyderabad: 'Hyderabad', kolkata: 'Kolkata',
  ahmedabad: 'Ahmedabad', jaipur: 'Jaipur', lucknow: 'Lucknow',
};

function getGreeting(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const h = new Date(utc + 5.5 * 3600000).getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function zoneName(z: ZoneEntry): string { return z.zone_name || z.name || 'Unknown'; }

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─────────────────────────────────────────────────────────────────────────────
// STREAK COLOURS  (amber → brand orange, "fire" gradient)
// ─────────────────────────────────────────────────────────────────────────────
const STREAK_COLORS = [
  '#FDE68A', '#FCD34D', '#FBBF24', '#F59E0B', '#F97316', '#EA580C', '#F07820',
];

// ─────────────────────────────────────────────────────────────────────────────
// FORECAST SPARKLINE
// ─────────────────────────────────────────────────────────────────────────────
function ForecastSparkline({ forecast }: { forecast: ForecastDay[] }) {
  const W = 340, H = 110;
  const days = forecast.slice(0, 5);

  if (days.length < 2) {
    return (
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', height: 110 }}>
        <line x1="0" y1={H * 0.55} x2={W} y2={H * 0.35} stroke="#1A40C0" strokeWidth="2.5" />
      </svg>
    );
  }

  const pts = days.map((day, i) => {
    const risk = Math.min(1, day.rain_mm / 80 + day.wind_kmh / 120 + Math.max(0, day.aqi - 50) / 500);
    return {
      x: (i / (days.length - 1)) * W,
      y: (H - 16) - risk * (H - 32),
    };
  });

  let linePath = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], c = pts[i];
    const mx = (p.x + c.x) / 2;
    linePath += ` C ${mx} ${p.y} ${mx} ${c.y} ${c.x} ${c.y}`;
  }
  const fillPath = `${linePath} L ${pts[pts.length - 1].x} ${H} L 0 ${H} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', height: 110 }}>
      <defs>
        <linearGradient id="dsh-spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(26,64,192,0.18)" />
          <stop offset="100%" stopColor="rgba(26,64,192,0)" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill="url(#dsh-spark-fill)" />
      <path d={linePath} fill="none" stroke="#1A40C0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOADING SKELETON
// ─────────────────────────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div style={{ background: '#F6F7F9', minHeight: '100vh', padding: '24px 20px' }}>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position:  400px 0; }
        }
        .skel {
          background: linear-gradient(90deg, #ebebeb 25%, #e0e0e0 50%, #ebebeb 75%);
          background-size: 800px 100%;
          animation: shimmer 1.8s ease-in-out infinite;
          border-radius: 12px;
        }
      `}</style>
      <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Header skeleton */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="skel" style={{ width: 110, height: 14, marginBottom: 8 }} />
            <div className="skel" style={{ width: 180, height: 28, borderRadius: 10 }} />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="skel" style={{ width: 44, height: 44, borderRadius: '50%' }} />
            <div className="skel" style={{ width: 44, height: 44, borderRadius: '50%' }} />
          </div>
        </div>
        {/* Cards skeleton */}
        <div className="skel" style={{ height: 168, borderRadius: 16 }} />
        <div className="skel" style={{ height: 190, borderRadius: 16 }} />
        <div className="skel" style={{ height: 230, borderRadius: 16 }} />
        <div style={{ display: 'flex', gap: 14 }}>
          <div className="skel" style={{ flex: 1, height: 148, borderRadius: 16 }} />
          <div className="skel" style={{ flex: 1, height: 148, borderRadius: 16 }} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR STATE
// ─────────────────────────────────────────────────────────────────────────────
function ErrorState() {
  return (
    <div style={{
      background: '#F6F7F9', minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '80px 20px',
    }}>
      <p style={{ fontSize: 20, fontWeight: 700, color: '#1A1A1A', marginBottom: 8, fontFamily: "var(--font-inter),'Inter',sans-serif" }}>
        Something went wrong
      </p>
      <p style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 1.5, fontFamily: "var(--font-inter),'Inter',sans-serif" }}>
        Could not load dashboard data. Pull down to refresh.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function DashboardHomePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Phase 1: Fast load (DB only, ~500 ms)
    fetch('/api/driver/dashboard?fast=1')
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((d: DashboardData) => {
        if (!d.profile) throw new Error();
        setData(d);
        setLoading(false);
        // Phase 2: Full load with ML predictions (background)
        fetch('/api/driver/dashboard')
          .then((res) => res.ok ? res.json() : null)
          .then((full: DashboardData | null) => { if (full?.profile) setData(full); })
          .catch(() => {});
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSkeleton />;
  if (!data)   return <ErrorState />;

  // ── Derived values ────────────────────────────────────────────────────────
  const cityName      = CITY_NAMES[data.profile.city] || data.profile.city;
  const driverZone    = data.zones.driver_zones?.[0];
  const driverZoneName = driverZone ? zoneName(driverZone) : `${cityName}-01`;

  // Zone card palette
  const zoneCardBg     = data.zone_status === 'safe' ? '#EEFBF3' : data.zone_status === 'alert' ? '#FFFBEB' : '#FEF2F2';
  const zoneCardBorder = data.zone_status === 'safe' ? '#B8E8C8' : data.zone_status === 'alert' ? '#FDE68A' : '#FECACA';
  const zoneDivider    = data.zone_status === 'safe' ? '#D1E8D8' : data.zone_status === 'alert' ? '#FDE68A' : '#FECACA';
  const zoneDotColor   = data.zone_status === 'safe' ? '#22C55E' : data.zone_status === 'alert' ? '#F59E0B' : '#EF4444';
  const zoneStatBorder = data.zone_status === 'safe' ? '#C8E8D4' : '#E5E7EB';

  // Policy progress
  const daysLeft    = data.policy
    ? Math.max(0, Math.ceil((new Date(data.policy.week_end).getTime() - Date.now()) / 86400000))
    : 0;
  const progressPct = Math.round((daysLeft / 7) * 100);

  // Forecast premium increase estimate
  const rainProb  = data.predictions?.rainfall?.probability ?? 0;
  const windProb  = data.predictions?.wind?.probability     ?? 0;
  const aqiProb   = data.predictions?.aqi?.probability      ?? 0;
  const forecastIncrease = Math.max(5, Math.round(rainProb * 35 + windProb * 20 + aqiProb * 15));
  const nextPremium      = data.policy ? Math.round(data.policy.premium * (1 + forecastIncrease / 100)) : null;
  const forecastDay      = data.forecast.find((d) => d.day_name === 'Mon') ?? data.forecast[Math.min(1, data.forecast.length - 1)];
  const forecastDayName  = forecastDay?.day_name ?? 'Mon';

  const forecastDesc = rainProb > 0.5
    ? `Monsoon approaching your zone. Renew early at ₹${data.policy?.premium ?? '--'}/wk before it rises to ₹${nextPremium ?? '--'}/wk.`
    : aqiProb > 0.5
    ? `Air quality risks ahead in ${cityName}. Current premium ₹${data.policy?.premium ?? '--'}/wk may rise to ₹${nextPremium ?? '--'}/wk.`
    : `Weather looks stable in ${cityName}. Lock in your current rate of ₹${data.policy?.premium ?? '--'}/wk now.`;

  // GigPoints tier
  const gigTier = data.coins.balance >= 3000 ? 'Elite Tier'
    : data.coins.balance >= 1500 ? 'Pro Tier'
    : data.coins.balance >= 500  ? 'Reliable Tier'
    : 'Starter Tier';

  // Net savings ROI (only show if there are earnings)
  const roiPct = data.wallet.total_earned > 0 && data.policy
    ? Math.round((data.wallet.total_earned / Math.max(data.policy.premium, 1)) * 100)
    : null;

  const notifCount = data.alerts.length;

  // ── Smart Reminders ────────────────────────────────────────────────────────
  const reminders: { Icon: React.ElementType; message: string; time: string; channel: string }[] = [];

  if (data.policy) {
    if (daysLeft <= 3) {
      const expDay = new Date(data.policy.week_end).toLocaleDateString('en-IN', { weekday: 'short' });
      reminders.push({
        Icon: Bell,
        message: `Your ${data.policy.name || data.policy.tier} expires ${expDay}! Renew to keep your coverage active.`,
        time: `${expDay} 6:00 PM`,
        channel: 'PUSH',
      });
    }
  } else {
    reminders.push({
      Icon: Bell,
      message: 'Get protected before the next disruption! Plans start at ₹80/week.',
      time: 'Today · Now',
      channel: 'PUSH',
    });
  }

  if (rainProb > 0.3) {
    const rainyDay = data.forecast.find((d) => d.rain_mm > 5)?.day_name ?? 'Monday';
    reminders.push({
      Icon: Phone,
      message: `Rain expected ${rainyDay}! Renew now to stay covered during heavy rainfall.`,
      time: `${rainyDay.slice(0, 3)} 10:00 AM`,
      channel: 'SMS',
    });
  } else if (reminders.length < 2) {
    reminders.push({
      Icon: Phone,
      message: 'Check your GigPoints — you may have rewards ready to redeem.',
      time: 'Daily · 9:00 AM',
      channel: 'SMS',
    });
  }

  // Always show exactly 2
  const displayReminders = reminders.slice(0, 2);

  // ── Zone Pool (derived from available data) ────────────────────────────────
  const poolZoneName = driverZoneName;
  const poolMembers  = 28 + (Object.keys(CITY_NAMES).indexOf(data.profile.city) + 1) * 2;
  const poolHealth   = data.zone_status === 'safe' ? 'Strong' : data.zone_status === 'alert' ? 'Moderate' : 'Low';
  const poolContrib  = data.policy ? Math.round(data.policy.premium * 0.1) : 10;

  // ── Filled streak count ────────────────────────────────────────────────────
  const filledCount = Math.min(data.streak, 7);

  const F = "var(--font-inter),'Inter',sans-serif";

  return (
    <div style={{ background: '#F6F7F9', minHeight: '100vh', paddingBottom: 16 }}>
      <style>{`
        @keyframes dsh-pulse {
          0%,100% { opacity:1; transform:scale(1);    }
          50%      { opacity:0.5; transform:scale(0.85); }
        }
        @keyframes dsh-up {
          from { opacity:0; transform:translateY(10px); }
          to   { opacity:1; transform:translateY(0);    }
        }
        .dsh-card {
          background: #ffffff;
          border: 1px solid #E8E8EA;
          border-radius: 16px;
          padding: 20px;
        }
        .dsh-s { animation: dsh-up 0.4s ease both; }
        .dsh-icon-btn {
          width:44px; height:44px; border-radius:50%;
          background:#fff; border:1px solid #E8E8EA;
          display:flex; align-items:center; justify-content:center;
          cursor:pointer; transition:background 0.18s;
        }
        .dsh-icon-btn:hover { background:#F6F7F9; }
      `}</style>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ══════════════════════════════════════════
            1. HEADER
        ══════════════════════════════════════════ */}
        <div className="dsh-s" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: 16, color: '#6B6B6B', margin: 0, lineHeight: 1.3, fontFamily: F }}>
              {getGreeting()},
            </p>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1A1A1A', margin: '4px 0 0', lineHeight: 1.2, letterSpacing: '-0.03em', fontFamily: F }}>
              {data.profile.full_name || 'Driver'}
            </h1>
          </div>

          <div style={{ display: 'flex', gap: 12, paddingTop: 2 }}>
            {/* Dark mode toggle (decorative) */}
            <button className="dsh-icon-btn" aria-label="Toggle dark mode">
              <Moon size={20} color="#374151" strokeWidth={1.5} />
            </button>

            {/* Notifications */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button className="dsh-icon-btn" aria-label="Notifications">
                <Bell size={20} color="#374151" strokeWidth={1.5} />
              </button>
              {notifCount > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -4,
                  minWidth: 18, height: 18, borderRadius: 9,
                  background: '#EF4444', color: '#fff',
                  fontSize: 11, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 4px',
                  border: '2px solid #F6F7F9',
                  fontFamily: F,
                }}>
                  {notifCount}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════
            2. ZONE STATUS CARD
        ══════════════════════════════════════════ */}
        <div
          className="dsh-s"
          style={{
            animationDelay: '0.05s',
            background: zoneCardBg,
            border: `1.5px solid ${zoneCardBorder}`,
            borderRadius: 16,
            padding: 20,
          }}
        >
          {/* Row 1: status + chevron */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 12, height: 12, borderRadius: '50%',
                background: zoneDotColor, display: 'inline-block', flexShrink: 0,
                boxShadow: `0 0 0 3px ${zoneDotColor}2A`,
                animation: data.zone_status !== 'safe' ? 'dsh-pulse 1.5s ease-in-out infinite' : 'none',
              }} />
              <span style={{ fontSize: 18, fontWeight: 700, color: zoneDotColor, fontFamily: F }}>
                ZONE {data.zone_status.toUpperCase()}
              </span>
            </div>
            <ChevronRight size={20} color="#9CA3AF" />
          </div>

          {/* Row 2: location */}
          <p style={{ fontSize: 14, color: '#4B5563', margin: '0 0 16px', fontFamily: F }}>
            {cityName} · {driverZoneName}
          </p>

          {/* Divider */}
          <div style={{ height: 1, background: zoneDivider, marginBottom: 16 }} />

          {/* Weather stats */}
          <div style={{ display: 'flex' }}>
            {([
              { Icon: CloudRain,   label: 'Rain', value: `${data.weather?.current_rain_mm ?? 0}mm` },
              { Icon: Thermometer, label: 'Temp', value: `${data.weather?.current_temp != null ? Math.round(data.weather.current_temp) : '--'}°C` },
              { Icon: Wind,        label: 'AQI',  value: `${data.weather?.current_aqi  || '--'}` },
            ] as const).map(({ Icon, label, value }, i) => (
              <div
                key={label}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 4,
                  borderRight: i < 2 ? `1px solid ${zoneStatBorder}` : 'none',
                }}
              >
                <Icon size={20} color="#6B7280" strokeWidth={1.5} />
                <span style={{ fontSize: 13, color: '#6B7280', fontFamily: F }}>{label}</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A', fontFamily: F }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════
            3. ACTIVE POLICY CARD
        ══════════════════════════════════════════ */}
        {data.policy ? (
          <div className="dsh-s dsh-card" style={{ animationDelay: '0.1s' }}>
            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: F }}>
                Active Policy
              </span>
              <span style={{
                fontSize: 13, fontWeight: 600, color: '#F07820',
                background: '#FEF3E8', border: '1px solid #F5C49A',
                borderRadius: 20, padding: '4px 14px', fontFamily: F,
              }}>
                {data.policy.name || data.policy.tier}
              </span>
            </div>

            {/* Max payout */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 44, fontWeight: 800, color: '#1A1A1A', lineHeight: 1, letterSpacing: '-0.03em', fontFamily: F }}>
                ₹{Number(data.policy.max_payout).toLocaleString('en-IN')}
              </span>
              <span style={{ fontSize: 16, color: '#6B7280', fontFamily: F }}>/week max</span>
            </div>

            {/* Validity */}
            <p style={{ fontSize: 14, color: '#4B5563', margin: '0 0 12px', fontFamily: F }}>
              Valid {fmtDate(data.policy.week_start)} – {fmtDate(data.policy.week_end)}
            </p>

            {/* Progress bar */}
            <div style={{ height: 8, borderRadius: 4, background: '#E5E7EB', overflow: 'hidden', marginBottom: 6 }}>
              <div style={{
                width: `${progressPct}%`, height: '100%', borderRadius: 4,
                background: 'linear-gradient(to right, #F07820, #1A40C0)',
                transition: 'width 0.6s ease',
              }} />
            </div>

            {/* Labels */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: '#6B7280', fontFamily: F }}>{daysLeft} of 7 days remaining</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#F07820', fontFamily: F }}>₹{data.policy.premium}/wk</span>
            </div>
          </div>
        ) : (
          <div className="dsh-s dsh-card" style={{ animationDelay: '0.1s', textAlign: 'center', padding: '28px 20px' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#F07820', marginBottom: 4, fontFamily: F }}>No Active Policy</p>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16, fontFamily: F }}>Get covered from as low as ₹80/week</p>
            <Link
              href="/onboarding"
              style={{
                display: 'inline-block', background: '#F07820', color: '#fff',
                borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 700,
                textDecoration: 'none', fontFamily: F,
              }}
            >
              Get Covered
            </Link>
          </div>
        )}

        {/* ══════════════════════════════════════════
            4. PREMIUM FORECAST CARD
        ══════════════════════════════════════════ */}
        <div
          className="dsh-s dsh-card"
          style={{ animationDelay: '0.15s', padding: '20px 20px 0', overflow: 'hidden' }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={18} color="#1A40C0" strokeWidth={2} />
              <span style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A', fontFamily: F }}>Premium Forecast</span>
            </div>
            <span style={{
              fontSize: 12, fontWeight: 600, color: '#EA580C',
              background: '#FFF3E6', border: '1px solid #FDBA74',
              borderRadius: 20, padding: '4px 12px', fontFamily: F,
              whiteSpace: 'nowrap',
            }}>
              +{forecastIncrease}% by {forecastDayName}
            </span>
          </div>

          {/* Description */}
          <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.55, margin: '0 0 16px', fontFamily: F }}>
            {forecastDesc}
          </p>

          {/* Sparkline — bleeds to card edges */}
          <div style={{ background: '#EEF2FF', marginLeft: -20, marginRight: -20 }}>
            <ForecastSparkline forecast={data.forecast} />
          </div>
        </div>

        {/* ══════════════════════════════════════════
            5. BOTTOM STATS ROW
        ══════════════════════════════════════════ */}
        <div
          className="dsh-s"
          style={{ animationDelay: '0.2s', display: 'flex', gap: 14, alignItems: 'stretch' }}
        >
          {/* GigPoints card */}
          <div className="dsh-card" style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Award size={18} color="#9CA3AF" strokeWidth={1.5} />
              <span style={{ fontSize: 14, color: '#4B5563', fontFamily: F }}>GigPoints</span>
            </div>
            <p style={{ fontSize: 34, fontWeight: 800, color: '#F07820', letterSpacing: '-0.03em', lineHeight: 1, margin: '0 0 8px', fontFamily: F }}>
              {Number(data.coins.balance).toLocaleString('en-IN')}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Shield size={14} color="#9CA3AF" strokeWidth={1.5} />
              <span style={{ fontSize: 13, color: '#6B7280', fontFamily: F }}>{gigTier}</span>
            </div>
          </div>

          {/* Net Savings card */}
          <div style={{
            flex: 1,
            background: 'linear-gradient(135deg, #F07820, #c95e10)',
            borderRadius: 16, padding: 20,
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <TrendingUp size={16} color="rgba(255,255,255,0.85)" strokeWidth={2} />
              <span style={{ fontSize: 14, color: '#fff', fontFamily: F }}>Net Savings</span>
            </div>
            <p style={{ fontSize: 34, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1, margin: '0 0 8px', fontFamily: F }}>
              ₹{Number(data.wallet.total_earned).toLocaleString('en-IN')}
            </p>
            {roiPct !== null ? (
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontFamily: F }}>{roiPct}% ROI</span>
            ) : (
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', fontFamily: F }}>No claims yet</span>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════
            6. STREAK CARD
        ══════════════════════════════════════════ */}
        <div className="dsh-s dsh-card" style={{ animationDelay: '0.25s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Flame size={18} color="#F59E0B" strokeWidth={2} />
              <span style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A', fontFamily: F }}>
                {data.streak > 0 ? `${data.streak}-Week Streak` : 'Start Your Streak'}
              </span>
            </div>
            <span style={{ fontSize: 14, color: '#6B7280', fontFamily: F }}>+75 pts/week</span>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            {Array.from({ length: 8 }).map((_, i) => {
              if (i === 7) {
                return (
                  <div key={i} style={{
                    flex: 1, height: 36, borderRadius: 10,
                    border: '1.5px dashed #C0C0C8', background: 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', fontFamily: F }}>W8</span>
                  </div>
                );
              }
              const filled = i < filledCount;
              return (
                <div key={i} style={{
                  flex: 1, height: 36, borderRadius: 10,
                  background: filled ? STREAK_COLORS[i] : '#F3F4F6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {filled
                    ? <Check size={14} color="#fff" strokeWidth={3} />
                    : <span style={{ fontSize: 11, fontWeight: 600, color: '#D1D5DB', fontFamily: F }}>W{i + 1}</span>
                  }
                </div>
              );
            })}
          </div>
        </div>

        {/* ══════════════════════════════════════════
            7. SMART REMINDERS CARD
        ══════════════════════════════════════════ */}
        <div className="dsh-s dsh-card" style={{ animationDelay: '0.3s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BellRing size={18} color="#F07820" strokeWidth={2} />
              <span style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A', fontFamily: F }}>Smart Reminders</span>
            </div>
            <span style={{
              fontSize: 12, fontWeight: 600, color: '#7C3AED',
              background: '#EDE9FE', border: '1px solid #C4B5FD',
              borderRadius: 20, padding: '4px 14px', fontFamily: F,
            }}>AI-Powered</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {displayReminders.map((r, i) => {
              const RIcon = r.Icon;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                    background: '#FEF3E8',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <RIcon size={18} color="#F07820" strokeWidth={1.8} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 14, color: '#374151', margin: '0 0 2px', fontFamily: F,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{r.message}</p>
                    <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0, fontFamily: F }}>
                      {r.time} · {r.channel}
                    </p>
                  </div>
                  <Check size={16} color="#22C55E" strokeWidth={2.5} style={{ flexShrink: 0 }} />
                </div>
              );
            })}
          </div>
        </div>

        {/* ══════════════════════════════════════════
            8. QUICK ACTIONS CARD
        ══════════════════════════════════════════ */}
        <div className="dsh-s dsh-card" style={{ animationDelay: '0.35s' }}>
          <p style={{
            fontSize: 13, fontWeight: 600, color: '#6B7280',
            textTransform: 'uppercase', letterSpacing: '1px',
            margin: '0 0 16px', fontFamily: F,
          }}>
            Quick Actions
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
            {([
              { label: 'Claims',  Icon: ClipboardCheck, color: '#F07820', bg: '#FEF3E8', href: '/dashboard/claims'  },
              { label: 'Wallet',  Icon: CreditCard,     color: '#1A40C0', bg: '#EEF2FF', href: '/dashboard/wallet'  },
              { label: 'Rewards', Icon: Users,          color: '#0EA5E9', bg: '#E0F2FE', href: '/dashboard/rewards' },
              { label: 'Help',    Icon: Headphones,     color: '#F59E0B', bg: '#FEF3C7', href: '/contact'           },
            ] as const).map(({ label, Icon, color, bg, href }) => (
              <Link key={label} href={href} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 14,
                    background: bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={24} color={color} strokeWidth={1.8} />
                  </div>
                  <span style={{ fontSize: 13, color: '#4B5563', fontFamily: F }}>{label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════
            9. ZONE POOL CARD
        ══════════════════════════════════════════ */}
        <div className="dsh-s dsh-card" style={{ animationDelay: '0.4s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users2 size={18} color="#F07820" strokeWidth={1.8} />
              <span style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A', fontFamily: F }}>Zone Pool</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#F07820', fontFamily: F }}>{poolZoneName}</span>
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            {([
              { value: String(poolMembers),                                           label: 'Members'      },
              { value: `₹${(poolMembers * poolContrib).toLocaleString('en-IN')}`,    label: 'Pool Balance' },
              { value: poolHealth,                                                     label: 'Health'       },
            ] as const).map(({ value, label }) => (
              <div key={label} style={{
                flex: 1, background: '#FEF3E8',
                borderRadius: 12, padding: '12px 8px', textAlign: 'center',
              }}>
                <p style={{ fontSize: 20, fontWeight: 700, color: '#F07820', lineHeight: 1, margin: '0 0 4px', fontFamily: F }}>
                  {value}
                </p>
                <p style={{ fontSize: 12, color: '#6B7280', margin: 0, fontFamily: F }}>{label}</p>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 13, color: '#6B7280', margin: 0, lineHeight: 1.4, fontFamily: F }}>
            Your contribution: ₹{poolContrib}/week · Covers ~2 below-threshold events
          </p>
        </div>

        {/* ══════════════════════════════════════════
            10. TODAY'S ACTIVITY CARD
        ══════════════════════════════════════════ */}
        <div className="dsh-s dsh-card" style={{ animationDelay: '0.45s' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '1px', margin: 0, fontFamily: F }}>
              Today&apos;s Activity
            </p>
            <span style={{ fontSize: 14, color: '#7C3AED', cursor: 'pointer', fontFamily: F }}>See All</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Row 1 — Rainfall / alert trigger */}
            {(() => {
              const hasAlert = data.alerts.length > 0;
              const alertLabel = hasAlert ? (data.alerts[0].event_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())) : 'Rainfall Trigger';
              const alertPayout = data.policy ? Math.round(data.policy.max_payout * 0.5) : 600;
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#EDE9FE', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CloudRain size={20} color="#7C3AED" strokeWidth={1.8} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A', margin: '0 0 2px', fontFamily: F }}>{alertLabel}</p>
                    <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0, fontFamily: F }}>
                      {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {cityName}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#F07820', margin: '0 0 2px', fontFamily: F }}>+₹{alertPayout}</p>
                    <p style={{ fontSize: 12, color: '#7C3AED', margin: 0, fontFamily: F }}>+200 pts</p>
                  </div>
                </div>
              );
            })()}

            {/* Divider */}
            <div style={{ height: 1, background: '#F3F4F6' }} />

            {/* Row 2 — Policy Active */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#FEF3E8', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={20} color="#F07820" strokeWidth={1.8} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A', margin: '0 0 2px', fontFamily: F }}>Policy Active</p>
                <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0, fontFamily: F }}>
                  {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {data.policy?.name || data.policy?.tier || 'No Plan'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════
            11. COVERAGE GAP ALERT CARD
        ══════════════════════════════════════════ */}
        <div className="dsh-s" style={{
          animationDelay: '0.5s',
          background: '#FFF5EB', border: '1.5px solid #FED7AA',
          borderRadius: 16, padding: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            {/* Warning icon */}
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#FFE4CC', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={22} color="#F97316" strokeWidth={2} />
            </div>
            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 17, fontWeight: 700, color: '#F97316', margin: '0 0 6px', fontFamily: F }}>Coverage Gap Alert</p>
              <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.5, margin: '0 0 14px', fontFamily: F }}>
                {poolMembers} active workers in your zone received payouts today. Stay protected for upcoming events.
              </p>
              <button style={{
                background: 'linear-gradient(to right, #F07820, #d96010)',
                color: '#fff', border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: 600, padding: '12px 24px',
                borderRadius: 24, fontFamily: F,
              }}>
                Enable Auto-Renew
              </button>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════
            12. EMERGENCY SOS CARD
        ══════════════════════════════════════════ */}
        <div className="dsh-s dsh-card" style={{ animationDelay: '0.55s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Heart icon */}
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#FEE2E2', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <HeartPulse size={22} color="#EF4444" strokeWidth={2} />
            </div>
            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A', margin: '0 0 3px', fontFamily: F }}>Emergency SOS</p>
              <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.4, margin: 0, fontFamily: F }}>
                Accident, health emergency, or safety issue
              </p>
            </div>
            {/* SOS button */}
            <button style={{
              border: '1.5px solid #FECACA', background: '#FFF1F2',
              borderRadius: 12, padding: '10px 18px', cursor: 'pointer', flexShrink: 0,
            }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#F87171', fontFamily: F }}>SOS</span>
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════
            13. LIVE WEATHER RADAR CARD
        ══════════════════════════════════════════ */}
        <div className="dsh-s dsh-card" style={{ animationDelay: '0.6s' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 16px', fontFamily: F }}>
            Live Weather Radar
          </p>

          {/* 4 time slots */}
          {(() => {
            const baseRain = data.weather?.current_rain_mm ?? 0;
            const slots = [
              { time: '1PM', rain: Math.max(0, baseRain + 3),  IconComp: Sun,          iconColor: '#FBBF24', highlight: false, border: false },
              { time: '2PM', rain: Math.max(0, baseRain + 8),  IconComp: Cloud,        iconColor: '#94A3B8', highlight: false, border: false },
              { time: '3PM', rain: Math.max(0, baseRain + 14), IconComp: CloudDrizzle, iconColor: '#60A5FA', highlight: true,  border: false },
              { time: '4PM', rain: Math.max(0, baseRain + 19), IconComp: CloudRain,    iconColor: '#3B82F6', highlight: false, border: true  },
            ];
            return (
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {slots.map(({ time, rain, IconComp, iconColor, highlight, border }) => (
                  <div key={time} style={{
                    flex: 1, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 6, padding: '10px 4px',
                    borderRadius: 12,
                    background: border ? '#FFF3E6' : highlight ? '#FEF9E7' : 'transparent',
                    border: border ? '1.5px solid #FDBA74' : 'none',
                  }}>
                    <span style={{ fontSize: 13, color: border ? '#F97316' : highlight ? '#B45309' : '#6B7280', fontFamily: F }}>{time}</span>
                    <IconComp size={28} color={iconColor} strokeWidth={1.5} />
                    <span style={{
                      fontSize: 15, fontWeight: 700, fontFamily: F,
                      color: border ? '#F97316' : highlight ? '#F59E0B' : '#1A1A1A',
                    }}>{rain.toFixed(0)}mm</span>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Warning footer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={14} color="#F59E0B" strokeWidth={2} />
            <span style={{ fontSize: 13, color: '#D97706', fontFamily: F }}>Trigger likely at 4PM — Stay protected!</span>
          </div>
        </div>

        {/* ══════════════════════════════════════════
            14. EARNINGS IMPACT CARD
        ══════════════════════════════════════════ */}
        <div className="dsh-s dsh-card" style={{ animationDelay: '0.65s' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 14px', fontFamily: F }}>
            Earnings Impact
          </p>

          {/* Comparison row */}
          <div style={{ display: 'flex', alignItems: 'stretch', marginBottom: 16 }}>
            {/* Left: without coverage */}
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 6px', fontFamily: F }}>Without SafeShift</p>
              <p style={{ fontSize: 30, fontWeight: 800, color: '#F87171', lineHeight: 1, margin: '0 0 4px', letterSpacing: '-0.03em', fontFamily: F }}>
                -₹{(data.wallet.total_earned + (data.policy?.premium ?? 100)).toLocaleString('en-IN')}
              </p>
              <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0, fontFamily: F }}>Lost to disruptions</p>
            </div>

            {/* Vertical divider */}
            <div style={{ width: 1, background: '#E5E7EB', margin: '0 16px', alignSelf: 'stretch' }} />

            {/* Right: with coverage */}
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 6px', fontFamily: F }}>With SafeShift</p>
              <p style={{ fontSize: 30, fontWeight: 800, color: '#F07820', lineHeight: 1, margin: '0 0 4px', letterSpacing: '-0.03em', fontFamily: F }}>
                +₹{Number(data.wallet.total_earned).toLocaleString('en-IN')}
              </p>
              <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0, fontFamily: F }}>Net protected</p>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height: 8, borderRadius: 4, background: '#E5E7EB', overflow: 'hidden', marginBottom: 10 }}>
            <div style={{
              width: '85%', height: '100%', borderRadius: 4,
              background: 'linear-gradient(to right, #F07820, #1A40C0)',
              transition: 'width 0.6s ease',
            }} />
          </div>

          {/* Footer */}
          <p style={{ fontSize: 13, color: '#F07820', margin: 0, lineHeight: 1.4, fontFamily: F }}>
            You&apos;re in the top 15% of protected earners in your zone
          </p>
        </div>

      </div>

    {/* ══════════════════════════════════════════
        15. FLOATING AI CHAT BUTTON (fixed)
    ══════════════════════════════════════════ */}
    <button
      aria-label="AI Chat"
      style={{
        position: 'fixed', bottom: 90, right: 20, zIndex: 50,
        width: 56, height: 56, borderRadius: '50%',
        background: 'linear-gradient(135deg, #F07820, #1A40C0)',
        border: 'none', cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <MessageCircle size={24} color="#fff" strokeWidth={2} />
      {/* AI badge */}
      <span style={{
        position: 'absolute', top: -2, right: -2,
        background: '#EF4444', color: '#fff',
        fontSize: 10, fontWeight: 700,
        borderRadius: 9, padding: '2px 5px',
        fontFamily: F, lineHeight: 1.4,
        border: '1.5px solid #F6F7F9',
      }}>AI</span>
    </button>
  </div>
  );
}
