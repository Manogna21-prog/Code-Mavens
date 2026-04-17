'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Bell, CloudRain, Thermometer, Wind, Coins,
  TrendingUp, Shield,
  BellRing, CreditCard,
  Check, Users2,
  Sun, Cloud, CloudDrizzle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getTranslator } from '@/lib/i18n/translations';

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
interface HourlyWeather { time: string; hour: number; temp: number; rain_mm: number; weather_code: number; }

interface DashboardData {
  profile: Profile;
  policy: Policy | null;
  weather: Weather;
  predictions: { rainfall: Prediction | null; wind: Prediction | null; aqi: Prediction | null; };
  forecast: ForecastDay[];
  hourly?: HourlyWeather[];
  alerts: AlertRow[];
  zones: { city_zones: ZoneEntry[]; driver_zones: ZoneEntry[]; };
  wallet: { total_earned: number; this_week_earned: number; total_claims: number; };
  coins: { balance: number; };
  streak: number;
  zone_status: 'safe' | 'alert' | 'danger';
  last_tier: string | null;
  next_week_policy: { tier: string | null; name: string | null; premium: number; week_start: string } | null;
  is_sunday_window: boolean;
  next_renewal_date: string | null;
  zone_claims: number;
  city_coords: { lat: number; lng: number } | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const CITY_NAMES: Record<string, string> = {
  mumbai: 'Mumbai', delhi: 'Delhi', bangalore: 'Bangalore', chennai: 'Chennai',
  pune: 'Pune', hyderabad: 'Hyderabad', kolkata: 'Kolkata',
  ahmedabad: 'Ahmedabad', jaipur: 'Jaipur', lucknow: 'Lucknow',
};

function getGreetingKey(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const h = new Date(utc + 5.5 * 3600000).getHours();
  if (h < 12) return 'greeting.morning';
  if (h < 17) return 'greeting.afternoon';
  return 'greeting.evening';
}

function zoneName(z: ZoneEntry): string { return z.zone_name || z.name || 'Unknown'; }

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─────────────────────────────────────────────────────────────────────────────
// STREAK COLOURS  (amber → brand orange, "fire" gradient)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// FORECAST SPARKLINE
// ─────────────────────────────────────────────────────────────────────────────
function ForecastSparkline({ forecast }: { forecast: ForecastDay[] }) {
  const days = forecast.slice(0, 5);

  // Layout constants
  const LEFT = 40;   // space for Y-axis labels
  const RIGHT = 10;
  const TOP = 12;
  const BOTTOM = 34; // space for X-axis day labels + title
  const CHART_W = 300;
  const CHART_H = 100;
  const W = LEFT + CHART_W + RIGHT;
  const H = TOP + CHART_H + BOTTOM;

  const yLabels = [
    { label: 'High', y: TOP },
    { label: 'Med', y: TOP + CHART_H * 0.5 },
    { label: 'Low', y: TOP + CHART_H },
  ];

  if (days.length < 2) {
    return (
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block', width: '100%', height: 'auto' }}>
        {/* Y-axis labels */}
        {yLabels.map(({ label, y }) => (
          <text key={label} x={LEFT - 6} y={y + 4} textAnchor="end" fontSize="9" fill="#9CA3AF" fontFamily="var(--font-inter),'Inter',sans-serif">{label}</text>
        ))}
        {/* Y-axis gridlines */}
        {yLabels.map(({ label, y }) => (
          <line key={`g-${label}`} x1={LEFT} y1={y} x2={LEFT + CHART_W} y2={y} stroke="#E5E7EB" strokeWidth="0.5" />
        ))}
        <line x1={LEFT} y1={TOP + CHART_H * 0.55} x2={LEFT + CHART_W} y2={TOP + CHART_H * 0.35} stroke="#1A40C0" strokeWidth="2.5" />
        <text x={W / 2} y={H - 4} textAnchor="middle" fontSize="9" fill="#9CA3AF" fontFamily="var(--font-inter),'Inter',sans-serif">No forecast data</text>
      </svg>
    );
  }

  const pts = days.map((day, i) => {
    const risk = Math.min(1, day.rain_mm / 80 + day.wind_kmh / 120 + Math.max(0, day.aqi - 50) / 500);
    return {
      x: LEFT + (i / (days.length - 1)) * CHART_W,
      y: TOP + (CHART_H - 8) - risk * (CHART_H - 16),
      risk,
      day_name: day.day_name,
    };
  });

  let linePath = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], c = pts[i];
    const mx = (p.x + c.x) / 2;
    linePath += ` C ${mx} ${p.y} ${mx} ${c.y} ${c.x} ${c.y}`;
  }
  const fillPath = `${linePath} L ${pts[pts.length - 1].x} ${TOP + CHART_H} L ${pts[0].x} ${TOP + CHART_H} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block', width: '100%', height: 'auto' }}>
      <defs>
        <linearGradient id="dsh-spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(26,64,192,0.18)" />
          <stop offset="100%" stopColor="rgba(26,64,192,0)" />
        </linearGradient>
      </defs>

      {/* Y-axis labels + gridlines */}
      {yLabels.map(({ label, y }) => (
        <g key={label}>
          <text x={LEFT - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#9CA3AF" fontFamily="var(--font-inter),'Inter',sans-serif">{label}</text>
          <line x1={LEFT} y1={y} x2={LEFT + CHART_W} y2={y} stroke="#E5E7EB" strokeWidth="0.5" strokeDasharray="4 3" />
        </g>
      ))}

      {/* Chart area */}
      <path d={fillPath} fill="url(#dsh-spark-fill)" />
      <path d={linePath} fill="none" stroke="#1A40C0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Data points + X-axis day labels */}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3.5} fill="#1A40C0" stroke="#fff" strokeWidth="1.5" />
          <text x={p.x} y={TOP + CHART_H + 14} textAnchor="middle" fontSize="9" fontWeight="600" fill="#6B7280" fontFamily="var(--font-inter),'Inter',sans-serif">
            {p.day_name}
          </text>
        </g>
      ))}

      {/* Axis label — Y */}
      <text x={8} y={TOP + CHART_H / 2} textAnchor="middle" fontSize="8" fill="#9CA3AF" fontFamily="var(--font-inter),'Inter',sans-serif" transform={`rotate(-90, 8, ${TOP + CHART_H / 2})`}>
        Risk Level
      </text>

      {/* Axis label — X */}
      <text x={LEFT + CHART_W / 2} y={TOP + CHART_H + 30} textAnchor="middle" fontSize="8" fill="#9CA3AF" fontFamily="var(--font-inter),'Inter',sans-serif">
        Forecast Day
      </text>
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
  const [userLang, setUserLang] = useState('en');
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifs, setNotifs] = useState<{ type: string; message: string; timestamp: string; pinned: boolean }[]>([]);
  const [notifsLoaded, setNotifsLoaded] = useState(false);

  useEffect(() => {
    // Fetch user language from profile
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('profiles').select('language').eq('id', user.id).single()
        .then(({ data: p }) => {
          if (p && (p as { language: string }).language) setUserLang((p as { language: string }).language);
        });
    });

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
        // Phase 3: Check-in — award any earned coins (fire and forget)
        fetch('/api/driver/check-in', { method: 'POST' }).catch(() => {});
        // Phase 4: Fetch notifications for activity card + notification panel
        fetch('/api/driver/notifications').then(r => r.json()).then(d => {
          if (d.notifications) setNotifs(d.notifications);
          setNotifsLoaded(true);
        }).catch(() => setNotifsLoaded(true));
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSkeleton />;
  if (!data)   return <ErrorState />;

  // ── i18n ──────────────────────────────────────────────────────────────────
  const t = getTranslator(userLang);

  // ── Derived values ────────────────────────────────────────────────────────
  const cityName      = CITY_NAMES[data.profile.city] || data.profile.city;
  const driverZone    = data.zones.driver_zones?.[0];
  const driverZoneName = driverZone ? zoneName(driverZone) : cityName;

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



  // GigPoints tier
  const gigTier = data.coins.balance >= 3000 ? t('tier.elite')
    : data.coins.balance >= 1500 ? t('tier.pro')
    : data.coins.balance >= 500  ? t('tier.reliable')
    : t('tier.starter');



  const notifCount = notifs.filter(n => n.type === 'claim').length;

  // ── Zone Pool (derived from available data) ────────────────────────────────
  const poolZoneName = driverZoneName;
  const poolMembers  = 28 + (Object.keys(CITY_NAMES).indexOf(data.profile.city) + 1) * 2;
  const zoneRisk     = driverZone?.risk_score ?? 0;
  const zoneRiskLabel = zoneRisk >= 0.65 ? 'High' : zoneRisk >= 0.35 ? 'Medium' : 'Low';
  const zoneRiskColor = zoneRisk >= 0.65 ? '#EF4444' : zoneRisk >= 0.35 ? '#F59E0B' : '#22C55E';

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
            <p style={{ fontSize: 16, color: '#6B7280', margin: 0, lineHeight: 1.3, fontFamily: F }}>
              {t(getGreetingKey())},
            </p>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1A1A1A', margin: '4px 0 0', lineHeight: 1.2, letterSpacing: '-0.03em', fontFamily: F }}>
              {data.profile.full_name || 'Driver'}
            </h1>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', alignSelf: 'center' }}>
            {/* Notifications */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button className="dsh-icon-btn" aria-label="Notifications" onClick={() => {
                setShowNotifs((prev) => !prev);
                if (!notifsLoaded) {
                  fetch('/api/driver/notifications').then(r => r.json()).then(d => {
                    if (d.notifications) setNotifs(d.notifications);
                    setNotifsLoaded(true);
                  }).catch(() => {});
                }
              }}>
                <Bell size={20} color={showNotifs ? '#F07820' : '#374151'} strokeWidth={1.5} />
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

            {/* Dynamic island — policy status pill */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: '#ffffff',
              borderRadius: 999,
              padding: '11px 22px 11px 16px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.10)',
              border: '1px solid #E8E8EA',
            }}>
            {data.policy ? (
              <span style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: '#F07820',
                boxShadow: '0 0 0 3px rgba(240,120,32,0.3)',
                animation: 'dsh-pulse 1.5s ease-in-out infinite',
                display: 'inline-block',
              }} />
            ) : (
              <span style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: '#6B7280',
                display: 'inline-block',
              }} />
            )}
            <span style={{
              fontSize: 12, fontWeight: 600, letterSpacing: '0.02em',
              color: data.policy ? '#F07820' : '#9CA3AF',
              fontFamily: F,
            }}>
              {data.policy ? 'Policy Active' : 'No Active Policy'}
            </span>
            </div>{/* end pill */}
          </div>{/* end right group */}
        </div>

        {/* ══════════════════════════════════════════
            1b. REMINDERS PANEL (toggle via bell)
        ══════════════════════════════════════════ */}
        {showNotifs && (
          <div className="dsh-s dsh-card" style={{ animationDelay: '0.02s', padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BellRing size={16} color="#F07820" strokeWidth={2} />
                <span style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', fontFamily: F }}>Notifications</span>
              </div>
              <button onClick={() => setShowNotifs(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <span style={{ fontSize: 18, color: '#9CA3AF', lineHeight: 1 }}>×</span>
              </button>
            </div>

            {/* Policy expiry reminder (always shown if active) */}
            {data.policy && daysLeft > 0 && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10, padding: '10px 12px', background: '#FEF3E8', borderRadius: 10 }}>
                <Shield size={16} color="#F07820" style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 13, color: '#1A1A1A', margin: 0, fontWeight: 600, fontFamily: F }}>Policy expires in {daysLeft} day{daysLeft > 1 ? 's' : ''}</p>
                  <p style={{ fontSize: 11, color: '#6B7280', margin: '2px 0 0', fontFamily: F }}>
                    {data.policy.name || data.policy.tier} · Valid till {fmtDate(data.policy.week_end)}
                  </p>
                </div>
              </div>
            )}

            {/* Claim notifications only */}
            {(() => {
              const claimNotifs = notifs.filter(n => n.type === 'claim');
              if (!notifsLoaded) return <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '12px 0', fontFamily: F }}>Loading...</p>;
              if (claimNotifs.length === 0) return <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '12px 0', fontFamily: F }}>No claim notifications yet</p>;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
                  {claimNotifs.map((n, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '8px 10px', borderRadius: 8,
                      background: '#EEFBF3', border: '1px solid #B8E8C8',
                    }}>
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%', flexShrink: 0, marginTop: 6,
                        background: '#22C55E',
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, color: '#1A1A1A', margin: 0, fontFamily: F, fontWeight: 600 }}>
                          {n.message}
                        </p>
                        <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0', fontFamily: F }}>
                          {new Date(n.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {new Date(n.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

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
          {/* Single row: dot + status/city | weather metrics */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>

            {/* Left — dot + status + city */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                background: zoneDotColor,
                boxShadow: `0 0 0 3px ${zoneDotColor}2A`,
                animation: data.zone_status !== 'safe' ? 'dsh-pulse 1.5s ease-in-out infinite' : 'none',
              }} />
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: zoneDotColor, fontFamily: F, lineHeight: 1.2 }}>
                  {t(`zone.${data.zone_status}`)}
                </div>
                <div style={{ fontSize: 12, color: '#4B5563', fontFamily: F, lineHeight: 1.2 }}>
                  {driverZoneName !== cityName ? `${cityName} · ${driverZoneName}` : cityName}
                </div>
              </div>
            </div>

            {/* Vertical divider */}
            <div style={{ width: 1, height: 36, background: zoneDivider, flexShrink: 0 }} />

            {/* Right — weather metrics */}
            <div style={{ display: 'flex', flex: 1 }}>
              {([
                { Icon: CloudRain,   label: t('zone.rain'), value: `${data.weather?.current_rain_mm ?? 0}mm` },
                { Icon: Thermometer, label: t('zone.temp'), value: `${data.weather?.current_temp != null ? Math.round(data.weather.current_temp) : '--'}°C` },
                { Icon: Wind,        label: t('zone.aqi'),  value: `${data.weather?.current_aqi  || '--'}` },
              ] as const).map(({ Icon, label, value }, i) => (
                <div key={label} style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 2,
                  borderRight: i < 2 ? `1px solid ${zoneStatBorder}` : 'none',
                }}>
                  <Icon size={14} color="#6B7280" strokeWidth={1.5} />
                  <span style={{ fontSize: 11, color: '#6B7280', fontFamily: F }}>{label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', fontFamily: F }}>{value}</span>
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* ══════════════════════════════════════════
            3. POLICY CARD — multiple states
        ══════════════════════════════════════════ */}
        {data.policy ? (
          /* ── STATE A: Active policy this week ── */
          <div id="card-policy" className="dsh-s dsh-card" style={{ animationDelay: '0.1s' }}>
            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: F }}>
                {t('policy.active')}
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
              <span style={{ fontSize: 16, color: '#6B7280', fontFamily: F }}>{t('policy.weekMax')}</span>
            </div>

            {/* Validity */}
            <p style={{ fontSize: 14, color: '#4B5563', margin: '0 0 12px', fontFamily: F }}>
              {t('policy.valid')} {fmtDate(data.policy.week_start)} – {fmtDate(data.policy.week_end)}
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
              <span style={{ fontSize: 13, color: '#6B7280', fontFamily: F }}>{t('policy.daysRemaining', { n: daysLeft })}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#F07820', fontFamily: F }}>₹{data.policy.premium}/wk</span>
            </div>

            {/* Sunday: renewal for next week */}
            {data.is_sunday_window && !data.next_week_policy && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #E5E7EB' }}>
                <Link
                  href={`/dashboard/policy/reinstate?tier=${data.policy.tier || data.last_tier || 'normal'}`}
                  style={{
                    display: 'block', textAlign: 'center',
                    background: '#F07820', color: '#fff',
                    borderRadius: 8, padding: '10px 0', fontSize: 14, fontWeight: 700,
                    textDecoration: 'none', fontFamily: F,
                  }}
                >
                  Renew for Next Week
                </Link>
              </div>
            )}

            {/* Next week already paid */}
            {data.next_week_policy && (
              <div style={{
                marginTop: 14, paddingTop: 14, borderTop: '1px solid #E5E7EB',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Check size={16} color="#22C55E" strokeWidth={3} />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#22C55E', fontFamily: F }}>
                  Next week premium ₹{data.next_week_policy.premium} paid
                </span>
              </div>
            )}
          </div>

        ) : data.next_week_policy ? (
          /* ── STATE B: Paid but not yet active (waiting for Monday) ── */
          <div className="dsh-s dsh-card" style={{ animationDelay: '0.1s', textAlign: 'center', padding: '28px 20px' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', background: '#EEF2FF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px',
            }}>
              <Shield size={22} color="#1A40C0" strokeWidth={2} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#1A40C0', marginBottom: 4, fontFamily: F }}>
              Policy Paid — Activates {(() => {
                const start = new Date(data.next_week_policy.week_start);
                const now = new Date();
                const diff = Math.ceil((start.getTime() - now.getTime()) / 86400000);
                return diff <= 1 ? 'Tomorrow' : `in ${diff} days`;
              })()}
            </p>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 4, fontFamily: F }}>
              {data.next_week_policy.name || data.next_week_policy.tier} plan · ₹{data.next_week_policy.premium}/wk
            </p>
            <p style={{ fontSize: 12, color: '#9CA3AF', fontFamily: F }}>
              Starts {new Date(data.next_week_policy.week_start).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
            </p>
          </div>

        ) : data.is_sunday_window && data.last_tier ? (
          /* ── STATE C: Sunday window open, user has expired policy ── */
          <div className="dsh-s dsh-card" style={{ animationDelay: '0.1s', textAlign: 'center', padding: '28px 20px' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#F07820', marginBottom: 4, fontFamily: F }}>
              Renewal Window Open
            </p>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16, fontFamily: F }}>
              Reinstate your {data.last_tier} plan before midnight to stay covered next week.
            </p>
            <Link
              href={`/dashboard/policy/reinstate?tier=${data.last_tier}`}
              style={{
                display: 'inline-block', background: '#F07820', color: '#fff',
                borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 700,
                textDecoration: 'none', fontFamily: F,
              }}
            >
              Reinstate Policy
            </Link>
          </div>

        ) : data.last_tier ? (
          /* ── STATE D: Not Sunday, has expired policy — show next window date ── */
          <div className="dsh-s dsh-card" style={{ animationDelay: '0.1s', textAlign: 'center', padding: '28px 20px' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#EF4444', marginBottom: 4, fontFamily: F }}>
              Policy Inactive
            </p>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 8, fontFamily: F }}>
              You can reinstate your policy on the next payment window.
            </p>
            {data.next_renewal_date && (
              <p style={{ fontSize: 14, fontWeight: 600, color: '#1A40C0', fontFamily: F }}>
                Next window: Sunday, {new Date(data.next_renewal_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </p>
            )}
          </div>

        ) : (
          /* ── STATE E: Brand new user, never had a policy ── */
          <div className="dsh-s dsh-card" style={{ animationDelay: '0.1s', textAlign: 'center', padding: '28px 20px' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#F07820', marginBottom: 4, fontFamily: F }}>{t('policy.none')}</p>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16, fontFamily: F }}>{t('policy.noneDesc')}</p>
            <Link
              href="/dashboard/policy/purchase"
              style={{
                display: 'inline-block', background: '#F07820', color: '#fff',
                borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 700,
                textDecoration: 'none', fontFamily: F,
              }}
            >
              {t('policy.getCovered')}
            </Link>
          </div>
        )}

        {/* ══════════════════════════════════════════
            4. PREMIUM FORECAST CARD
        ══════════════════════════════════════════ */}
        <div
          className="dsh-s dsh-card"
          style={{ animationDelay: '0.15s', padding: 20 }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={18} color="#1A40C0" strokeWidth={2} />
              <span style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A', fontFamily: F }}>{t('forecast.title')}</span>
            </div>
          </div>

          {/* Sparkline — bleeds to card edges */}
          <div style={{ background: '#EEF2FF', margin: '0 -20px -20px' }}>
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
          {/* SafeShift Coins card */}
          <div id="card-coins" className="dsh-card" style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Coins size={18} color="#F07820" strokeWidth={1.5} />
              <span style={{ fontSize: 14, color: '#4B5563', fontFamily: F }}>SafeShift Coins</span>
            </div>
            <p style={{ fontSize: 34, fontWeight: 800, color: '#F07820', letterSpacing: '-0.03em', lineHeight: 1, margin: '0 0 8px', fontFamily: F }}>
              {Number(data.coins.balance).toLocaleString('en-IN')}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Shield size={14} color="#9CA3AF" strokeWidth={1.5} />
              <span style={{ fontSize: 13, color: '#6B7280', fontFamily: F }}>{gigTier}</span>
            </div>
          </div>

          {/* Total Payouts card */}
          <div id="card-payouts" style={{
            flex: 1,
            background: 'linear-gradient(135deg, #F07820, #c95e10)',
            borderRadius: 16, padding: 20,
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <CreditCard size={16} color="rgba(255,255,255,0.85)" strokeWidth={2} />
              <span style={{ fontSize: 14, color: '#fff', fontFamily: F }}>Total Payouts</span>
            </div>
            <p style={{ fontSize: 34, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1, margin: '0 0 8px', fontFamily: F }}>
              ₹{Number(data.wallet.total_earned).toLocaleString('en-IN')}
            </p>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontFamily: F }}>
              {data.wallet.total_claims > 0 ? `${data.wallet.total_claims} claim${data.wallet.total_claims > 1 ? 's' : ''} paid` : 'No claims yet'}
            </span>
          </div>
        </div>



        {/* ══════════════════════════════════════════
            RECENT ACTIVITY CARD
        ══════════════════════════════════════════ */}
        <div className="dsh-s dsh-card" style={{ animationDelay: '0.4s' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 14px', fontFamily: F }}>
            Recent Activity
          </p>

          {(() => {
            const activityItems = notifs.filter(n => n.type === 'coin' || n.type === 'policy');
            if (!notifsLoaded) return <p style={{ fontSize: 13, color: '#9CA3AF', fontFamily: F }}>Loading...</p>;
            if (activityItems.length === 0) return <p style={{ fontSize: 13, color: '#9CA3AF', fontFamily: F }}>No activity yet</p>;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 280, overflowY: 'auto' }}>
                {activityItems.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                      background: item.type === 'coin' ? '#FEF3E8' : '#EEF2FF',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {item.type === 'coin'
                        ? <Coins size={16} color="#F07820" strokeWidth={1.8} />
                        : <Shield size={16} color="#1A40C0" strokeWidth={1.8} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, color: '#1A1A1A', margin: 0, lineHeight: 1.4, fontFamily: F }}>
                        {item.message}
                      </p>
                      <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0', fontFamily: F }}>
                        {new Date(item.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {new Date(item.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* ══════════════════════════════════════════
            LIVE WEATHER — 24hr scrollable
        ══════════════════════════════════════════ */}
        <div className="dsh-s dsh-card" style={{ animationDelay: '0.45s', padding: '20px 20px 16px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CloudRain size={16} color="#F07820" strokeWidth={2} />
              <span style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', fontFamily: F }}>24-Hour Forecast</span>
            </div>
            <span style={{ fontSize: 12, color: '#9CA3AF', fontFamily: F }}>{cityName}</span>
          </div>

          {/* Current conditions summary */}
          {data.weather && (
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, padding: '12px 14px', background: '#FEF3E8', borderRadius: 12, border: '1px solid #F5C49A' }}>
              <div>
                <span style={{ fontSize: 32, fontWeight: 800, color: '#F07820', fontFamily: F }}>{data.weather.current_temp != null ? Math.round(data.weather.current_temp) : '--'}°</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
                <span style={{ fontSize: 12, color: '#6B7280', fontFamily: F }}>Rain: {data.weather.current_rain_mm ?? 0}mm</span>
                <span style={{ fontSize: 12, color: '#6B7280', fontFamily: F }}>AQI: {data.weather.current_aqi || '--'}</span>
              </div>
            </div>
          )}

          {(() => {
            const hours = data.hourly ?? [];
            if (hours.length === 0) return <p style={{ fontSize: 13, color: '#9CA3AF', fontFamily: F }}>Weather data loading...</p>;

            const nowHour = new Date().getHours();

            function weatherIcon(code: number, hour: number) {
              const isNight = hour < 6 || hour >= 20;
              if (code >= 61) return { Icon: CloudRain, color: '#3B82F6' };
              if (code >= 51) return { Icon: CloudDrizzle, color: '#60A5FA' };
              if (code >= 3)  return { Icon: Cloud, color: '#94A3B8' };
              return { Icon: isNight ? Cloud : Sun, color: isNight ? '#94A3B8' : '#FBBF24' };
            }

            return (
              <div style={{ overflowX: 'auto', margin: '0 -20px', padding: '0 20px' }}>
                <div style={{ display: 'flex', gap: 6, minWidth: hours.length * 64 }}>
                  {hours.map((h) => {
                    const isCurrent = h.hour === nowHour;
                    const { Icon: WIcon, color: wColor } = weatherIcon(h.weather_code, h.hour);
                    const label = h.hour === 0 ? '12AM' : h.hour < 12 ? `${h.hour}AM` : h.hour === 12 ? '12PM' : `${h.hour - 12}PM`;

                    return (
                      <div key={h.time} style={{
                        flex: '0 0 58px', display: 'flex', flexDirection: 'column',
                        alignItems: 'center', gap: 6, padding: '10px 4px 8px',
                        borderRadius: 14,
                        background: isCurrent ? '#FEF3E8' : '#ffffff',
                        border: `1.5px solid ${isCurrent ? '#F07820' : '#F5C49A'}`,
                      }}>
                        <span style={{
                          fontSize: 10, fontWeight: isCurrent ? 700 : 500, letterSpacing: '0.02em',
                          color: isCurrent ? '#F07820' : '#9CA3AF', fontFamily: F,
                        }}>{isCurrent ? 'NOW' : label}</span>
                        <WIcon size={20} color={isCurrent ? '#F07820' : wColor} strokeWidth={1.5} />
                        <span style={{
                          fontSize: 14, fontWeight: 700, fontFamily: F,
                          color: isCurrent ? '#F07820' : '#1A1A1A',
                        }}>
                          {Math.round(h.temp)}°
                        </span>
                        {h.rain_mm > 0 && (
                          <span style={{ fontSize: 9, color: '#3B82F6', fontWeight: 600, fontFamily: F }}>
                            {h.rain_mm.toFixed(1)}mm
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        {/* ══════════════════════════════════════════
            ZONE MAP CARD (was Zone Pool)
        ══════════════════════════════════════════ */}
        <div className="dsh-s dsh-card" style={{ animationDelay: '0.5s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users2 size={18} color="#F07820" strokeWidth={1.8} />
              <span style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A', fontFamily: F }}>Your Zone</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#F07820', fontFamily: F }}>{poolZoneName}</span>
          </div>

          {/* Stats row: Members, Risk Level, Claims */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            {([
              { value: String(poolMembers), label: 'Members', color: '#22C55E' },
              { value: zoneRiskLabel, label: 'Risk Level', color: zoneRiskColor },
              { value: String(data.zone_claims), label: 'Claims Paid', color: '#22C55E' },
            ]).map(({ value, label, color }) => (
              <div key={label} style={{
                flex: 1, background: '#FEF3E8',
                borderRadius: 12, padding: '12px 8px', textAlign: 'center',
              }}>
                <p style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1, margin: '0 0 4px', fontFamily: F }}>
                  {value}
                </p>
                <p style={{ fontSize: 11, color: '#6B7280', margin: 0, fontFamily: F }}>{label}</p>
              </div>
            ))}
          </div>

          {/* Interactive OpenStreetMap */}
          {data.city_coords && (
            <div style={{ borderRadius: 12, overflow: 'hidden', height: 220, border: '1px solid #E8E8EA' }}>
              <iframe
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${data.city_coords.lng - 0.08},${data.city_coords.lat - 0.05},${data.city_coords.lng + 0.08},${data.city_coords.lat + 0.05}&layer=mapnik&marker=${data.city_coords.lat},${data.city_coords.lng}`}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title="Zone map"
              />
            </div>
          )}
        </div>


      </div>

  </div>
  );
}
