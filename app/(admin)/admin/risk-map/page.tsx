'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { CITIES, type City } from '@/lib/config/cities';

// ---------------------------------------------------------------------------
// Dynamic import for Leaflet map (SSR-incompatible)
// ---------------------------------------------------------------------------

const ZoneRiskMap = dynamic(() => import('@/components/admin/ZoneRiskMap'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: 400,
        background: 'var(--cream-d, #f5f3ee)',
        borderRadius: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <p className="mono text-sm" style={{ color: 'var(--ink-60)' }}>Loading map...</p>
    </div>
  ),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Zone {
  zone_id: string;
  name: string;
  lat: number;
  lng: number;
  risk_score: number;
  risk_factors: string[];
}

interface ZonesResponse {
  city: string;
  total_zones: number;
  zones: Zone[];
}

interface ForecastDay {
  date: string;
  dayLabel: string;
  tempMax: number;
  tempMin: number;
  rain: number;
  windMax: number;
}

interface CityRiskWeights {
  rainfall: number;
  wind: number;
  aqi: number;
}

// ML-service city risk weights (mirrors the Python CITY_RISK_WEIGHTS)
const CITY_WEIGHTS: Record<string, CityRiskWeights> = {
  mumbai:    { rainfall: 0.50, wind: 0.20, aqi: 0.30 },
  delhi:     { rainfall: 0.20, wind: 0.10, aqi: 0.70 },
  bangalore: { rainfall: 0.50, wind: 0.15, aqi: 0.35 },
  chennai:   { rainfall: 0.35, wind: 0.40, aqi: 0.25 },
  pune:      { rainfall: 0.50, wind: 0.15, aqi: 0.35 },
  hyderabad: { rainfall: 0.40, wind: 0.25, aqi: 0.35 },
  kolkata:   { rainfall: 0.40, wind: 0.30, aqi: 0.30 },
  ahmedabad: { rainfall: 0.30, wind: 0.30, aqi: 0.40 },
  jaipur:    { rainfall: 0.20, wind: 0.15, aqi: 0.65 },
  lucknow:   { rainfall: 0.25, wind: 0.10, aqi: 0.65 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function riskColor(score: number): string {
  if (score > 0.7) return 'var(--red-acc)';
  if (score > 0.4) return '#b45309';
  return 'var(--teal)';
}

function riskLabel(score: number): 'SAFE' | 'WATCH' | 'DISRUPTED' {
  if (score > 0.7) return 'DISRUPTED';
  if (score > 0.4) return 'WATCH';
  return 'SAFE';
}

function statusBadgeStyle(s: 'SAFE' | 'WATCH' | 'DISRUPTED'): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    SAFE: { background: 'rgba(13,148,136,0.1)', color: 'var(--teal)', border: '1px solid var(--teal)' },
    WATCH: { background: 'rgba(234,179,8,0.1)', color: '#b45309', border: '1px solid #eab308' },
    DISRUPTED: { background: 'rgba(192,57,43,0.08)', color: 'var(--red-acc)', border: '1px solid var(--red-acc)' },
  };
  return map[s];
}

function dayName(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RiskMapPage() {
  const [selectedCity, setSelectedCity] = useState<City>(CITIES[0]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [loadingZones, setLoadingZones] = useState(false);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [zoneError, setZoneError] = useState('');

  const ML_URL = process.env.NEXT_PUBLIC_ML_SERVICE_URL || 'http://localhost:8001';

  // ---- Fetch zones from ML service --------------------------------------

  const fetchZones = useCallback(async (city: City) => {
    setLoadingZones(true);
    setZoneError('');
    try {
      const res = await fetch(`${ML_URL}/zones/${city.slug}`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ZonesResponse = await res.json();
      setZones(data.zones);
    } catch {
      // Fallback: use static zone data built into the page
      setZoneError('ML service unavailable — showing static zone data');
      setZones([]);
    } finally {
      setLoadingZones(false);
    }
  }, [ML_URL]);

  // ---- Fetch 5-day forecast from Open-Meteo -----------------------------

  const fetchForecast = useCallback(async (city: City) => {
    setLoadingForecast(true);
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${city.latitude}&longitude=${city.longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=Asia/Kolkata&forecast_days=5`,
        { signal: AbortSignal.timeout(6000) },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const days: ForecastDay[] = data.daily.time.map((t: string, i: number) => ({
        date: t,
        dayLabel: dayName(t),
        tempMax: data.daily.temperature_2m_max[i],
        tempMin: data.daily.temperature_2m_min[i],
        rain: data.daily.precipitation_sum[i],
        windMax: data.daily.wind_speed_10m_max[i],
      }));
      setForecast(days);
    } catch {
      setForecast([]);
    } finally {
      setLoadingForecast(false);
    }
  }, []);

  useEffect(() => {
    fetchZones(selectedCity);
    fetchForecast(selectedCity);
  }, [selectedCity, fetchZones, fetchForecast]);

  // ---- Derived ----------------------------------------------------------

  const avgRisk = zones.length > 0 ? zones.reduce((s, z) => s + z.risk_score, 0) / zones.length : 0;
  const cityWeights = CITY_WEIGHTS[selectedCity.slug] ?? { rainfall: 0.33, wind: 0.33, aqi: 0.34 };

  // Determine dominant disruption type for this city
  const dominantTypes: string[] = [];
  if (cityWeights.rainfall >= 0.4) dominantTypes.push('Heavy Rainfall / Flood');
  if (cityWeights.aqi >= 0.5) dominantTypes.push('AQI / GRAP-IV');
  if (cityWeights.wind >= 0.3) dominantTypes.push('Cyclone / High Wind');
  if (selectedCity.cyclone_prone) dominantTypes.push('Cyclone exposure');
  if (dominantTypes.length === 0) dominantTypes.push('Balanced risk profile');

  // ---- Render ------------------------------------------------------------

  return (
    <div className="space-y-6">
      <h1 className="serif text-2xl font-bold" style={{ color: 'var(--ink)' }}>Risk Map &amp; Forecast</h1>

      {/* ---- City Selector ---- */}
      <div className="rounded-xl p-4" style={{ border: '1px solid var(--rule)' }}>
        <label className="mono text-xs uppercase tracking-wide font-medium block mb-2" style={{ color: 'var(--ink-60)' }}>
          Select City
        </label>
        <select
          value={selectedCity.slug}
          onChange={(e) => {
            const c = CITIES.find((x) => x.slug === e.target.value);
            if (c) setSelectedCity(c);
          }}
          className="w-full max-w-sm rounded-lg px-3 py-2 text-sm"
          style={{ border: '1px solid var(--rule)', background: 'var(--cream)' }}
        >
          {CITIES.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}, {c.state}</option>
          ))}
        </select>
      </div>

      {/* ---- Zone Risk Heatmap (Leaflet) ---- */}
      <div>
        <h2 className="serif font-semibold mb-3" style={{ color: 'var(--ink)' }}>
          Zone Risk Heatmap {selectedCity.name && `\u2014 ${selectedCity.name}`}
        </h2>
        <div style={{ border: '1px solid var(--rule)', borderRadius: 16, overflow: 'hidden' }}>
          {loadingZones ? (
            <div
              style={{
                height: 400,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--cream-d, #f5f3ee)',
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-5 h-5 rounded-full animate-spin"
                  style={{ border: '2px solid var(--ink-10)', borderTopColor: 'var(--teal)' }}
                />
                <span className="mono text-sm" style={{ color: 'var(--ink-60)' }}>Loading zones...</span>
              </div>
            </div>
          ) : zones.length === 0 ? (
            <div
              style={{
                height: 400,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--cream-d, #f5f3ee)',
              }}
            >
              <p className="mono text-sm" style={{ color: 'var(--ink-30)' }}>
                No zone data to display on map
              </p>
            </div>
          ) : (
            <ZoneRiskMap
              zones={zones}
              cityLat={selectedCity.latitude}
              cityLng={selectedCity.longitude}
              cityName={selectedCity.name}
            />
          )}
        </div>
      </div>

      {/* ---- Zone Risk Cards ---- */}
      <div>
        <h2 className="serif font-semibold mb-3" style={{ color: 'var(--ink)' }}>
          Zone Risk Cards {selectedCity.name && `\u2014 ${selectedCity.name}`}
        </h2>
        {zoneError && (
          <p className="mono text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(234,179,8,0.1)', color: '#b45309', border: '1px solid #eab308' }}>
            {zoneError}
          </p>
        )}
        {loadingZones ? (
          <div className="flex items-center gap-2 py-8 justify-center">
            <div
              className="w-5 h-5 rounded-full animate-spin"
              style={{ border: '2px solid var(--ink-10)', borderTopColor: 'var(--teal)' }}
            />
            <span className="mono text-sm" style={{ color: 'var(--ink-60)' }}>Loading zones...</span>
          </div>
        ) : zones.length === 0 ? (
          <p className="mono text-sm py-6 text-center" style={{ color: 'var(--ink-30)' }}>
            No zone data available for {selectedCity.name}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {zones.map((z) => {
              const label = riskLabel(z.risk_score);
              return (
                <div
                  key={z.zone_id}
                  className="rounded-xl p-4 transition-colors"
                  style={{ border: '1px solid var(--rule)', transition: 'all 0.2s ease' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--teal-bg)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(17,16,16,0.08)'; e.currentTarget.style.borderColor = 'var(--teal)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = ''; }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-semibold" style={{ color: 'var(--ink)' }}>{z.name}</div>
                      <div className="mono text-xs" style={{ color: 'var(--ink-30)' }}>{z.zone_id}</div>
                    </div>
                    <span
                      className="mono text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ ...statusBadgeStyle(label), transition: 'transform 0.15s ease', display: 'inline-block' }}
                      onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                      onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                    >
                      {label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="mono text-xs" style={{ color: 'var(--ink-60)' }}>Risk Score</span>
                    <span className="serif text-lg font-bold" style={{ color: riskColor(z.risk_score) }}>
                      {(z.risk_score * 100).toFixed(0)}%
                    </span>
                  </div>
                  {/* Risk bar */}
                  <div className="h-2 rounded-full mb-3" style={{ background: 'var(--ink-10)' }}>
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{ width: `${z.risk_score * 100}%`, background: riskColor(z.risk_score), transition: 'all 0.15s ease', cursor: 'pointer', transformOrigin: 'left' }}
                      onMouseOver={e => { e.currentTarget.style.transform = 'scaleX(1.02)'; e.currentTarget.style.opacity = '0.85'; }}
                      onMouseOut={e => { e.currentTarget.style.transform = 'scaleX(1)'; e.currentTarget.style.opacity = '1'; }}
                    />
                  </div>
                  {/* Risk factors */}
                  <div className="flex flex-wrap gap-1">
                    {z.risk_factors.map((f) => (
                      <span
                        key={f}
                        className="mono text-xs px-2 py-0.5 rounded-full"
                        style={{ background: 'var(--ink-10)', color: 'var(--ink-60)', transition: 'transform 0.15s ease', display: 'inline-block' }}
                        onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                        onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                      >
                        {f.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---- 5-Day Forecast ---- */}
      <div>
        <h2 className="serif font-semibold mb-3" style={{ color: 'var(--ink)' }}>
          5-Day Forecast {selectedCity.name && `\u2014 ${selectedCity.name}`}
        </h2>
        {loadingForecast ? (
          <div className="flex items-center gap-2 py-8 justify-center">
            <div
              className="w-5 h-5 rounded-full animate-spin"
              style={{ border: '2px solid var(--ink-10)', borderTopColor: 'var(--teal)' }}
            />
            <span className="mono text-sm" style={{ color: 'var(--ink-60)' }}>Loading forecast...</span>
          </div>
        ) : forecast.length === 0 ? (
          <p className="mono text-sm py-6 text-center" style={{ color: 'var(--ink-30)' }}>
            Forecast data unavailable
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {forecast.map((d) => (
              <div key={d.date} className="rounded-xl p-4 text-center" style={{ border: '1px solid var(--rule)', transition: 'all 0.2s ease' }} onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(17,16,16,0.08)'; }} onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                <div className="mono text-xs font-medium mb-2" style={{ color: 'var(--ink-60)' }}>{d.dayLabel}</div>
                <div className="serif text-xl font-bold" style={{ color: 'var(--ink)' }}>
                  {d.tempMax.toFixed(0)}&deg;
                </div>
                <div className="mono text-xs" style={{ color: 'var(--ink-30)' }}>
                  {d.tempMin.toFixed(0)}&deg; low
                </div>
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="mono" style={{ color: 'var(--ink-60)' }}>Rain</span>
                    <span
                      className="mono font-medium"
                      style={{ color: d.rain > 20 ? 'var(--red-acc)' : d.rain > 5 ? '#b45309' : 'var(--teal)' }}
                    >
                      {d.rain.toFixed(1)} mm
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="mono" style={{ color: 'var(--ink-60)' }}>Wind</span>
                    <span
                      className="mono font-medium"
                      style={{ color: d.windMax > 50 ? 'var(--red-acc)' : d.windMax > 30 ? '#b45309' : 'var(--teal)' }}
                    >
                      {d.windMax.toFixed(0)} km/h
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- City Risk Summary ---- */}
      <div className="rounded-xl p-5" style={{ border: '1px solid var(--rule)', transition: 'all 0.2s ease' }} onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(17,16,16,0.08)'; }} onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
        <h2 className="serif font-semibold mb-4" style={{ color: 'var(--ink)' }}>
          City Risk Summary {selectedCity.name && `\u2014 ${selectedCity.name}`}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Average risk */}
          <div>
            <div className="mono text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--ink-60)' }}>
              Average Zone Risk
            </div>
            <div className="flex items-center gap-3">
              <span className="serif text-3xl font-bold" style={{ color: riskColor(avgRisk) }}>
                {(avgRisk * 100).toFixed(1)}%
              </span>
              <span
                className="mono text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ ...statusBadgeStyle(riskLabel(avgRisk)), transition: 'transform 0.15s ease', display: 'inline-block' }}
                onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                {riskLabel(avgRisk)}
              </span>
            </div>
            <div className="h-2 rounded-full mt-2" style={{ background: 'var(--ink-10)', maxWidth: 200 }}>
              <div
                className="h-2 rounded-full"
                style={{ width: `${avgRisk * 100}%`, background: riskColor(avgRisk) }}
              />
            </div>
          </div>

          {/* Dominant disruption types */}
          <div>
            <div className="mono text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--ink-60)' }}>
              Primary Disruption Risks
            </div>
            <div className="space-y-1.5">
              {dominantTypes.map((t) => (
                <div key={t} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: 'var(--red-acc)' }} />
                  <span className="text-sm" style={{ color: 'var(--ink)' }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Risk weights */}
        <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--rule)' }}>
          <div className="mono text-xs uppercase tracking-wide mb-3" style={{ color: 'var(--ink-60)' }}>
            City Risk Weights (ML Model)
          </div>
          <div className="space-y-2">
            {Object.entries(cityWeights).map(([key, weight]) => (
              <div key={key} className="flex items-center gap-3">
                <span className="mono text-sm capitalize w-20" style={{ color: 'var(--ink-60)' }}>{key}</span>
                <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--ink-10)' }}>
                  <div
                    className="h-2 rounded-full"
                    style={{ background: 'var(--teal)', width: `${weight * 100}%`, transition: 'all 0.15s ease', cursor: 'pointer', transformOrigin: 'left' }}
                    onMouseOver={e => { e.currentTarget.style.transform = 'scaleX(1.02)'; e.currentTarget.style.opacity = '0.85'; }}
                    onMouseOut={e => { e.currentTarget.style.transform = 'scaleX(1)'; e.currentTarget.style.opacity = '1'; }}
                  />
                </div>
                <span className="serif text-sm font-medium w-12 text-right">{(weight * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* City flags */}
        <div className="mt-4 flex flex-wrap gap-2">
          {selectedCity.flood_prone && (
            <span className="mono text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(59,130,246,0.1)', color: '#2563eb', border: '1px solid #3b82f6', transition: 'transform 0.15s ease', display: 'inline-block' }} onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.05)'; }} onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; }}>
              Flood Prone
            </span>
          )}
          {selectedCity.aqi_prone && (
            <span className="mono text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(234,179,8,0.1)', color: '#b45309', border: '1px solid #eab308', transition: 'transform 0.15s ease', display: 'inline-block' }} onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.05)'; }} onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; }}>
              AQI Prone
            </span>
          )}
          {selectedCity.cyclone_prone && (
            <span className="mono text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(192,57,43,0.08)', color: 'var(--red-acc)', border: '1px solid var(--red-acc)', transition: 'transform 0.15s ease', display: 'inline-block' }} onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.05)'; }} onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; }}>
              Cyclone Prone
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
