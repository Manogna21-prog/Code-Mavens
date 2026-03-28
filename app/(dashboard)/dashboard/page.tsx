'use client';

import { useState, useEffect } from 'react';
import { TRIGGERS } from '@/lib/config/constants';
import type { DisruptionType } from '@/lib/config/constants';

// ---------------------------------------------------------------------------
// Types matching GET /api/driver/dashboard response
// ---------------------------------------------------------------------------

interface Profile {
  full_name: string | null;
  city: string;
  trust_score: number;
}

interface Policy {
  tier: string | null;
  name: string | null;
  premium: number;
  max_payout: number;
  week_start: string;
  week_end: string;
}

interface Weather {
  current_temp: number | null;
  current_rain_mm: number | null;
  current_aqi: number;
  current_wind: number | null;
}

interface Prediction {
  probability: number;
  risk_level: string;
  aqi_current?: number;
}

interface ForecastDay {
  date: string;
  day_name: string;
  temp_max: number;
  temp_min: number;
  rain_mm: number;
  wind_kmh: number;
  aqi: number;
}

interface AlertRow {
  id: string;
  event_type: string;
  severity_score: number;
  city: string;
  trigger_value: number | null;
  created_at: string;
}

interface ZoneEntry {
  zone_id?: string;
  zone_name?: string;
  name?: string;
  risk_score: number;
  risk_factors?: string[];
  active_alerts?: number;
}

interface DashboardData {
  profile: Profile;
  policy: Policy | null;
  weather: Weather;
  predictions: {
    rainfall: Prediction | null;
    wind: Prediction | null;
    aqi: Prediction | null;
  };
  forecast: ForecastDay[];
  alerts: AlertRow[];
  zones: {
    city_zones: ZoneEntry[];
    driver_zones: ZoneEntry[];
  };
  wallet: {
    total_earned: number;
    this_week_earned: number;
    total_claims: number;
  };
  coins: {
    balance: number;
  };
  streak: number;
  zone_status: 'safe' | 'alert' | 'danger';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map city slug to display name */
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

function getGreeting(): string {
  // IST is UTC+5:30
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const istHour = new Date(utc + 5.5 * 3600000).getHours();
  if (istHour < 12) return 'Good morning';
  if (istHour < 17) return 'Good afternoon';
  return 'Good evening';
}

function zoneColor(status: string): string {
  if (status === 'danger') return 'var(--red-acc)';
  if (status === 'alert') return '#f59e0b';
  return 'var(--teal)';
}

function weatherEmoji(day: ForecastDay): string {
  if (day.rain_mm > 10) return '\u{1F327}\u{FE0F}'; // rain cloud
  if (day.rain_mm > 2) return '\u{1F326}\u{FE0F}';  // sun behind rain
  if (day.wind_kmh > 40) return '\u{1F4A8}';         // wind
  if (day.aqi > 300) return '\u{1F32B}\u{FE0F}';     // fog
  if (day.temp_max > 38) return '\u{1F525}';          // fire
  return '\u2600\u{FE0F}';                            // sun
}

function isTriggerExceeded(day: ForecastDay): boolean {
  return day.rain_mm > 65 || day.wind_kmh > 70 || day.aqi > 450;
}

function getAlertColor(eventType: string): string {
  if (eventType === 'heavy_rainfall' || eventType === 'cyclone') return '#ef4444';
  if (eventType === 'aqi_grap_iv') return '#f59e0b';
  return '#ef4444';
}

function zoneName(z: ZoneEntry): string {
  return z.zone_name || z.name || 'Unknown';
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div style={{ padding: '28px 20px', background: 'var(--cream)' }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .skel {
          background: linear-gradient(90deg, #f0efeb 25%, #e8e7e3 50%, #f0efeb 75%);
          background-size: 800px 100%;
          animation: shimmer 1.8s ease-in-out infinite;
          border-radius: 16px;
        }
      `}</style>

      {/* Header */}
      <div className="skel" style={{ width: 110, height: 14, marginBottom: 10, borderRadius: 8 }} />
      <div className="skel" style={{ width: 200, height: 30, marginBottom: 14, borderRadius: 10 }} />
      <div className="skel" style={{ width: 160, height: 32, marginBottom: 24, borderRadius: 16 }} />

      {/* Weather stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <div className="skel" style={{ flex: 1, height: 88, borderRadius: 12 }} />
        <div className="skel" style={{ flex: 1, height: 88, borderRadius: 12 }} />
        <div className="skel" style={{ flex: 1, height: 88, borderRadius: 12 }} />
      </div>

      {/* Savings grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
        <div className="skel" style={{ height: 110 }} />
        <div className="skel" style={{ height: 110 }} />
        <div className="skel" style={{ height: 110 }} />
      </div>

      {/* Alert block */}
      <div className="skel" style={{ height: 160, marginBottom: 24 }} />

      {/* Forecast block */}
      <div className="skel" style={{ height: 200, marginBottom: 24 }} />

      {/* Zone risk */}
      <div className="skel" style={{ height: 140, marginBottom: 24 }} />

      {/* Reminders */}
      <div className="skel" style={{ height: 80 }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ErrorState() {
  return (
    <div style={{
      padding: '80px 20px',
      textAlign: 'center',
      background: 'var(--cream)',
      minHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #fef2f2, #fee2e2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        fontSize: 28,
      }}>
        !
      </div>
      <p className="serif" style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
        Something went wrong
      </p>
      <p className="sans" style={{ fontSize: 14, color: 'var(--ink-60)', marginTop: 8, lineHeight: 1.5 }}>
        Could not load dashboard data. Pull down to refresh.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function DashboardHomePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Phase 1: Fast load (DB only, ~500ms)
    fetch('/api/driver/dashboard?fast=1')
      .then((res) => {
        if (!res.ok) throw new Error('Unauthorized');
        return res.json();
      })
      .then((d: DashboardData) => {
        if (!d.profile) throw new Error('Invalid data');
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
  if (!data) return <ErrorState />;

  const cityName = CITY_NAMES[data.profile.city] || data.profile.city;
  const statusColor = zoneColor(data.zone_status);
  const driverZone = data.zones.driver_zones?.[0];
  const driverZoneName = driverZone ? zoneName(driverZone) : cityName;

  // Build unified alert list: live disruptions + high-probability predictions
  const alertItems: { key: string; label: string; probability: number; color: string; zone: string }[] = [];

  for (const a of data.alerts) {
    const t = TRIGGERS[a.event_type as DisruptionType];
    alertItems.push({
      key: a.id,
      label: t?.label || a.event_type,
      probability: Math.round(a.severity_score * 10),
      color: getAlertColor(a.event_type),
      zone: cityName,
    });
  }

  // Add ML predictions with high probability (>40%) that are not already represented by live alerts
  const liveTypes = new Set(data.alerts.map((a) => a.event_type));

  if (data.predictions?.rainfall && data.predictions.rainfall.probability > 0.4 && !liveTypes.has('heavy_rainfall')) {
    alertItems.push({
      key: 'pred-rain',
      label: TRIGGERS.heavy_rainfall.label,
      probability: Math.round(data.predictions.rainfall.probability * 100),
      color: '#ef4444',
      zone: cityName,
    });
  }
  if (data.predictions?.wind && data.predictions.wind.probability > 0.4 && !liveTypes.has('cyclone')) {
    alertItems.push({
      key: 'pred-wind',
      label: TRIGGERS.cyclone.label,
      probability: Math.round(data.predictions.wind.probability * 100),
      color: '#ef4444',
      zone: cityName,
    });
  }
  if (data.predictions?.aqi && data.predictions.aqi.probability > 0.4 && !liveTypes.has('aqi_grap_iv')) {
    alertItems.push({
      key: 'pred-aqi',
      label: TRIGGERS.aqi_grap_iv.label,
      probability: Math.round(data.predictions.aqi.probability * 100),
      color: '#f59e0b',
      zone: cityName,
    });
  }

  // Build reminders
  const reminders: { icon: string; text: string }[] = [];

  if (data.policy) {
    const endDate = new Date(data.policy.week_end);
    const now = new Date();
    const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / 86400000);
    if (daysLeft <= 3 && daysLeft >= 0) {
      reminders.push({
        icon: '\u{1F6E1}\u{FE0F}',
        text: `Your ${data.policy.name || data.policy.tier} coverage expires ${endDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}! Renew to stay protected.`,
      });
    }
  } else {
    reminders.push({
      icon: '\u26A0\u{FE0F}',
      text: "You're unprotected! Get covered for as low as \u20B980/week.",
    });
  }

  if (data.predictions?.rainfall && data.predictions.rainfall.probability > 0.5) {
    reminders.push({
      icon: '\u{1F327}\u{FE0F}',
      text: `Rain alert! ${Math.round(data.predictions.rainfall.probability * 100)}% chance of heavy rainfall this week.`,
    });
  }

  if (data.streak >= 4) {
    reminders.push({
      icon: '\u{1F525}',
      text: `${data.streak}-week streak! Keep going to earn bonus SafeShift Coins.`,
    });
  }

  // Compute active_alerts count per zone from live data
  const alertsByCity = data.alerts.reduce<Record<string, number>>((acc, a) => {
    acc[a.city] = (acc[a.city] || 0) + 1;
    return acc;
  }, {});

  // Gradient helpers for alert/risk colors
  const alertGradient = (color: string) => {
    if (color === '#ef4444') return 'linear-gradient(90deg, #fecaca, #fca5a5)';
    if (color === '#f59e0b') return 'linear-gradient(90deg, #fde68a, #fcd34d)';
    return 'linear-gradient(90deg, #99f6e4, #5eead4)';
  };

  const alertEmoji = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes('rain') || l.includes('flood')) return '\u{1F327}\u{FE0F}';
    if (l.includes('wind') || l.includes('cyclone')) return '\u{1F4A8}';
    if (l.includes('aqi') || l.includes('air') || l.includes('grap')) return '\u{1F32B}\u{FE0F}';
    if (l.includes('heat')) return '\u{1F525}';
    return '\u26A0\u{FE0F}';
  };

  const reminderBorderColor = (i: number) => {
    const colors = ['var(--teal)', '#f59e0b', '#3b82f6', '#8b5cf6'];
    return colors[i % colors.length];
  };

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh', paddingBottom: 32 }}>
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .dash-card {
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(17,16,16,0.04);
          padding: 20px;
          transition: all 0.2s ease;
        }
        .dash-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(17,16,16,0.08);
        }
        .dash-section {
          animation: fade-in-up 0.4s ease both;
        }
        .forecast-scroll {
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .forecast-scroll::-webkit-scrollbar {
          display: none;
        }
        .forecast-card {
          scroll-snap-align: start;
        }
      `}</style>

      {/* ------------------------------------------------------------------ */}
      {/* Section 1: Header + Zone Status + Weather Stats                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="dash-section" style={{ padding: '28px 20px 0' }}>
        <p className="sans" style={{ fontSize: 14, color: 'var(--ink-60)', marginBottom: 4, letterSpacing: '0.01em' }}>
          {getGreeting()},
        </p>
        <h1
          className="serif"
          style={{
            fontSize: 30,
            fontWeight: 900,
            color: 'var(--ink)',
            letterSpacing: '-0.03em',
            lineHeight: 1.2,
            margin: 0,
          }}
        >
          {data.profile.full_name || 'Driver'}
        </h1>

        {/* Zone status pill badge */}
        <div style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px 6px 10px',
              borderRadius: 20,
              background: data.zone_status === 'safe'
                ? 'linear-gradient(135deg, #f0fdfa, #e6fffa)'
                : data.zone_status === 'alert'
                  ? 'linear-gradient(135deg, #fffbeb, #fef3c7)'
                  : 'linear-gradient(135deg, #fef2f2, #fee2e2)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: statusColor,
                display: 'inline-block',
                animation: data.zone_status !== 'safe' ? 'pulse-dot 1.5s ease-in-out infinite' : 'none',
                boxShadow: `0 0 6px ${statusColor}40`,
              }}
            />
            <span
              className="mono"
              style={{
                fontSize: 11,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: statusColor,
                fontWeight: 600,
              }}
            >
              ZONE {data.zone_status.toUpperCase()}
            </span>
            <span className="sans" style={{ fontSize: 12, color: 'var(--ink-60)' }}>
              &middot; {cityName}{driverZone ? ` \u00B7 ${zoneName(driverZone)}` : ''}
            </span>
          </div>
        </div>

        {/* Weather stats row */}
        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <WeatherMiniCard
            gradient="linear-gradient(135deg, #e0f2fe, #bae6fd)"
            value={`${data.weather?.current_rain_mm ?? 0}mm`}
            label="Rain"
            textColor="#0369a1"
          />
          <WeatherMiniCard
            gradient="linear-gradient(135deg, #fef3c7, #fde68a)"
            value={`${data.weather?.current_temp != null ? Math.round(data.weather.current_temp) : '--'}\u00B0C`}
            label="Temp"
            textColor="#92400e"
          />
          <WeatherMiniCard
            gradient="linear-gradient(135deg, #ede9fe, #ddd6fe)"
            value={`${data.weather?.current_aqi || '--'}`}
            label="AQI"
            textColor="#6d28d9"
          />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 2: Savings + Coins + Streak                                */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="dash-section"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 12,
          padding: '20px 20px 0',
          animationDelay: '0.05s',
        }}
      >
        {/* Net Savings card */}
        <div
          className="dash-card"
          style={{
            padding: 0,
            overflow: 'hidden',
            position: 'relative',
            background: 'linear-gradient(135deg, #ccfbf1, #99f6e4)',
          }}
        >
          <div style={{ padding: '16px 16px 18px' }}>
            <p
              className="mono"
              style={{
                fontSize: 10,
                color: '#0f766e',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 8,
              }}
            >
              Net Savings
            </p>
            <p className="serif" style={{
              fontSize: 26,
              fontWeight: 900,
              color: '#115e59',
              letterSpacing: '-0.04em',
              lineHeight: 1,
            }}>
              {'\u20B9'}{Number(data.wallet.total_earned).toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        {/* Coins card */}
        <div
          className="dash-card"
          style={{
            padding: 0,
            overflow: 'hidden',
          }}
        >
          <div style={{
            height: 3,
            background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
            borderRadius: '16px 16px 0 0',
          }} />
          <div style={{ padding: '16px 16px 18px' }}>
            <p
              className="mono"
              style={{
                fontSize: 10,
                color: 'var(--ink-60)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 8,
              }}
            >
              SafeShift Coins
            </p>
            <p className="serif" style={{
              fontSize: 26,
              fontWeight: 900,
              color: 'var(--ink)',
              letterSpacing: '-0.04em',
              lineHeight: 1,
            }}>
              {Number(data.coins.balance).toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        {/* Streak card */}
        <div
          className="dash-card"
          style={{
            padding: 0,
            overflow: 'hidden',
          }}
        >
          <div style={{
            height: 3,
            background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)',
            borderRadius: '16px 16px 0 0',
          }} />
          <div style={{ padding: '16px 16px 18px' }}>
            <p
              className="mono"
              style={{
                fontSize: 10,
                color: 'var(--ink-60)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 8,
              }}
            >
              Streak
            </p>
            <p className="serif" style={{
              fontSize: 26,
              fontWeight: 900,
              color: 'var(--ink)',
              letterSpacing: '-0.04em',
              lineHeight: 1,
            }}>
              {data.streak}<span className="sans" style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-60)', marginLeft: 3 }}>wk</span>
            </p>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 3: Active Alerts                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="dash-section" style={{ padding: '20px 20px 0', animationDelay: '0.1s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <p
            className="mono"
            style={{
              fontSize: 11,
              color: 'var(--ink-60)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              margin: 0,
            }}
          >
            Active Alerts
          </p>
          {alertItems.length > 0 && (
            <span
              className="mono"
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#ffffff',
                background: 'linear-gradient(135deg, #ef4444, #f87171)',
                padding: '2px 8px',
                borderRadius: 10,
                lineHeight: '16px',
              }}
            >
              {alertItems.length}
            </span>
          )}
        </div>

        {alertItems.length === 0 ? (
          <div
            className="dash-card"
            style={{
              textAlign: 'center',
              padding: '32px 20px',
            }}
          >
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #f0fdfa, #ccfbf1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
              fontSize: 22,
            }}>
              {'\u2713'}
            </div>
            <p className="serif" style={{ fontSize: 16, fontWeight: 700, color: '#0d9488', margin: 0 }}>
              All Clear
            </p>
            <p className="sans" style={{ fontSize: 13, color: 'var(--ink-60)', marginTop: 6, lineHeight: 1.4 }}>
              No active disruptions in your zone
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {alertItems.map((item) => (
              <div
                key={item.key}
                className="dash-card"
                style={{
                  padding: 0,
                  overflow: 'hidden',
                  display: 'flex',
                  cursor: 'default',
                }}
              >
                {/* Left colored accent bar */}
                <div style={{
                  width: 4,
                  flexShrink: 0,
                  borderRadius: '16px 0 0 16px',
                  background: alertGradient(item.color),
                }} />
                <div style={{ flex: 1, padding: '16px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{alertEmoji(item.label)}</span>
                      <span className="sans" style={{ color: 'var(--ink)', fontWeight: 600, fontSize: 15 }}>
                        {item.label}
                      </span>
                    </div>
                    <span className="mono" style={{
                      fontSize: 13,
                      color: item.color,
                      fontWeight: 700,
                    }}>
                      {item.probability}%
                    </span>
                  </div>
                  <p className="sans" style={{ fontSize: 12, color: 'var(--ink-60)', margin: '4px 0 12px', lineHeight: 1.4 }}>
                    {item.zone} &middot; Automatic claim will trigger if conditions persist
                  </p>
                  {/* Probability progress bar */}
                  <div style={{
                    height: 6,
                    borderRadius: 3,
                    background: 'var(--ink-10)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${item.probability}%`,
                      height: '100%',
                      borderRadius: 3,
                      background: alertGradient(item.color),
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 4: 5-Day Forecast                                          */}
      {/* ------------------------------------------------------------------ */}
      {data.forecast.length > 0 && (
        <div className="dash-section" style={{ padding: '20px 20px 0', animationDelay: '0.15s' }}>
          <p
            className="mono"
            style={{
              fontSize: 11,
              color: 'var(--ink-60)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 14,
            }}
          >
            5-Day Forecast
          </p>

          <div style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 18,
            background: 'linear-gradient(180deg, #e0f2fe 0%, #bae6fd 40%, #f0f9ff 100%)',
            padding: '20px 14px 18px',
          }}>
            <style>{`
              @keyframes float-cloud-1 {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(calc(100vw + 100%)); }
              }
              @keyframes float-cloud-2 {
                0% { transform: translateX(calc(-100% - 50px)); }
                100% { transform: translateX(calc(100vw + 100%)); }
              }
            `}</style>
            {/* Animated cloud shapes */}
            <div style={{ position: 'absolute', top: 10, left: 0, width: 80, height: 30, background: 'rgba(255,255,255,0.7)', borderRadius: 20, filter: 'blur(4px)', animation: 'float-cloud-1 25s linear infinite' }} />
            <div style={{ position: 'absolute', top: 50, left: 0, width: 60, height: 22, background: 'rgba(255,255,255,0.5)', borderRadius: 16, filter: 'blur(3px)', animation: 'float-cloud-2 35s linear infinite', animationDelay: '-10s' }} />
            <div style={{ position: 'absolute', bottom: 20, left: 0, width: 100, height: 35, background: 'rgba(255,255,255,0.6)', borderRadius: 24, filter: 'blur(5px)', animation: 'float-cloud-1 30s linear infinite', animationDelay: '-15s' }} />

            <div
              className="forecast-scroll"
              style={{
                display: 'flex',
                gap: 10,
                overflowX: 'auto',
                paddingBottom: 4,
                position: 'relative',
                zIndex: 1,
              }}
            >
              {data.forecast.map((day) => {
                const exceeded = isTriggerExceeded(day);
                return (
                  <div
                    key={day.date}
                    className="forecast-card"
                    style={{
                      minWidth: 105,
                      flex: '0 0 auto',
                      background: 'rgba(255,255,255,0.85)',
                      backdropFilter: 'blur(8px)',
                      WebkitBackdropFilter: 'blur(8px)',
                      borderRadius: 14,
                      padding: '14px 12px 16px',
                      textAlign: 'center',
                      boxShadow: exceeded
                        ? '0 0 12px rgba(239,68,68,0.3)'
                        : '0 4px 20px rgba(17,16,16,0.04)',
                      transition: 'all 0.2s ease',
                      cursor: 'default',
                      position: 'relative',
                      zIndex: 1,
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-3px)';
                      e.currentTarget.style.boxShadow = exceeded
                        ? '0 0 16px rgba(239,68,68,0.4)'
                        : '0 8px 30px rgba(13,148,136,0.12), 0 0 0 1.5px rgba(13,148,136,0.2)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = exceeded
                        ? '0 0 12px rgba(239,68,68,0.3)'
                        : '0 4px 20px rgba(17,16,16,0.04)';
                    }}
                  >
                    <p className="mono" style={{
                      fontSize: 10,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginBottom: 6,
                    }}>
                      {day.day_name}
                    </p>
                    <p style={{ fontSize: 28, margin: '4px 0 6px', lineHeight: 1 }}>{weatherEmoji(day)}</p>
                    <p className="serif" style={{
                      fontSize: 20,
                      color: '#0f172a',
                      fontWeight: 800,
                      letterSpacing: '-0.03em',
                      margin: '2px 0 10px',
                    }}>
                      {Math.round(day.temp_max)}&deg;
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <span style={{ fontSize: 10 }}>{'\u{1F4A7}'}</span>
                        <span className="mono" style={{ fontSize: 10, color: '#64748b' }}>
                          {day.rain_mm.toFixed(0)}mm
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <span style={{ fontSize: 10 }}>{'\u{1F4A8}'}</span>
                        <span className="mono" style={{ fontSize: 10, color: '#64748b' }}>
                          {Math.round(day.wind_kmh)}km/h
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <span style={{ fontSize: 10 }}>{'\u{1F32B}\u{FE0F}'}</span>
                        <span
                          className="mono"
                          style={{
                            fontSize: 10,
                            fontWeight: day.aqi > 300 ? 700 : 400,
                            color:
                              day.aqi > 300
                                ? '#ef4444'
                                : day.aqi > 150
                                  ? '#f59e0b'
                                  : '#0d9488',
                          }}
                        >
                          {day.aqi || '--'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Section 5: Zone Risk Levels                                        */}
      {/* ------------------------------------------------------------------ */}
      {data.zones.city_zones.length > 0 && (
        <div className="dash-section" style={{ padding: '20px 20px 0', animationDelay: '0.2s' }}>
          <p
            className="mono"
            style={{
              fontSize: 11,
              color: 'var(--ink-60)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 14,
            }}
          >
            Zone Risk Levels
          </p>

          <div className="dash-card" style={{ padding: '4px 0' }}>
            {data.zones.city_zones.map((z, i) => {
              const risk = z.risk_score ?? 0;
              const name = zoneName(z);
              const active = alertsByCity[data.profile.city] || 0;

              const riskColor = risk > 0.7 ? '#ef4444' : risk > 0.5 ? '#f59e0b' : '#0d9488';
              const riskGrad = risk > 0.7
                ? 'linear-gradient(90deg, #fecaca, #fca5a5)'
                : risk > 0.5
                  ? 'linear-gradient(90deg, #fde68a, #fcd34d)'
                  : 'linear-gradient(90deg, #99f6e4, #5eead4)';
              const riskLabel = risk > 0.7 ? 'HIGH' : risk > 0.5 ? 'MEDIUM' : 'LOW';
              const riskPillBg = risk > 0.7
                ? 'linear-gradient(135deg, #fef2f2, #fee2e2)'
                : risk > 0.5
                  ? 'linear-gradient(135deg, #fffbeb, #fef3c7)'
                  : 'linear-gradient(135deg, #f0fdfa, #ccfbf1)';
              const riskPct = Math.round(risk * 100);

              return (
                <div
                  key={z.zone_id || `zone-${i}`}
                  onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(13,148,136,0.03)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  style={{
                    padding: '14px 20px',
                    borderBottom: i < data.zones.city_zones.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                    transition: 'background 0.2s ease',
                    cursor: 'default',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="sans" style={{ color: 'var(--ink)', fontWeight: 600, fontSize: 14 }}>
                        {name}
                      </span>
                      {i === 0 && active > 0 && (
                        <span className="mono" style={{
                          fontSize: 10,
                          color: '#ef4444',
                          background: '#fef2f2',
                          padding: '1px 6px',
                          borderRadius: 6,
                          fontWeight: 600,
                        }}>
                          {active} active
                        </span>
                      )}
                    </div>
                    <span
                      className="mono"
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: 10,
                        color: riskColor,
                        background: riskPillBg,
                        letterSpacing: '0.06em',
                      }}
                    >
                      {riskLabel}
                    </span>
                  </div>
                  {/* Full-width progress bar */}
                  <div style={{
                    height: 6,
                    borderRadius: 3,
                    background: 'var(--ink-10)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${riskPct}%`,
                      height: '100%',
                      borderRadius: 3,
                      background: riskGrad,
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Section 6: Smart Reminders                                         */}
      {/* ------------------------------------------------------------------ */}
      {reminders.length > 0 && (
        <div className="dash-section" style={{ padding: '20px 20px 0', animationDelay: '0.25s' }}>
          <p
            className="mono"
            style={{
              fontSize: 11,
              color: 'var(--ink-60)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 14,
            }}
          >
            Smart Reminders
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {reminders.map((r, i) => (
              <div
                key={i}
                className="dash-card"
                style={{
                  background: '#ffffff',
                  borderLeft: `3px solid ${reminderBorderColor(i)}`,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 14,
                  padding: '16px 18px',
                }}
              >
                <span style={{
                  fontSize: 22,
                  lineHeight: 1,
                  flexShrink: 0,
                  marginTop: 1,
                }}>
                  {r.icon}
                </span>
                <p className="sans" style={{
                  fontSize: 14,
                  color: 'var(--ink)',
                  lineHeight: 1.5,
                  margin: 0,
                }}>
                  {r.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function WeatherMiniCard({ gradient, value, label, textColor }: { gradient: string; value: string; label: string; textColor: string }) {
  return (
    <div
      style={{
        flex: 1,
        background: gradient,
        borderRadius: 12,
        padding: '14px 10px 16px',
        textAlign: 'center',
        boxShadow: '0 4px 15px rgba(0,0,0,0.06)',
        transition: 'all 0.2s ease',
        cursor: 'default',
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.10)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.06)';
      }}
    >
      <p className="serif" style={{
        fontSize: 22,
        fontWeight: 800,
        color: textColor,
        margin: '0 0 2px',
        letterSpacing: '-0.03em',
      }}>
        {value}
      </p>
      <p className="mono" style={{
        fontSize: 9,
        color: textColor,
        opacity: 0.7,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        margin: 0,
      }}>
        {label}
      </p>
    </div>
  );
}
