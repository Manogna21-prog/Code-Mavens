'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CITIES } from '@/lib/config/cities';
import { TrendingUp, TrendingDown } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KPI {
  label: string;
  value: string;
  trend: number; // positive = good
  trendLabel: string;
}

interface WeeklyBar {
  week: string;
  premiums: number;
  payouts: number;
}

interface ZoneStatusEntry {
  label: string;
  count: number;
  color: string;
}

interface CityRow {
  city: string;
  status: 'SAFE' | 'WATCH' | 'DISRUPTED';
  riskScore: number;
  activeWorkers: number;
  rain: string;
  aqi: string;
  temp: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function weekKey(d: Date): string {
  const start = new Date(d);
  start.setDate(start.getDate() - start.getDay());
  return start.toISOString().slice(0, 10);
}

function fmtINR(n: number): string {
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString('en-IN');
}

function statusBadge(s: 'SAFE' | 'WATCH' | 'DISRUPTED'): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    SAFE: { background: 'rgba(13,148,136,0.1)', color: 'var(--teal)', border: '1px solid var(--teal)' },
    WATCH: { background: 'rgba(234,179,8,0.1)', color: '#b45309', border: '1px solid #eab308' },
    DISRUPTED: { background: 'rgba(192,57,43,0.08)', color: 'var(--red-acc)', border: '1px solid var(--red-acc)' },
  };
  return map[s];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminOverviewPage() {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [weeklyBars, setWeeklyBars] = useState<WeeklyBar[]>([]);
  const [zoneStatus, setZoneStatus] = useState<ZoneStatusEntry[]>([]);
  const [cityRows, setCityRows] = useState<CityRow[]>([]);
  const [loading, setLoading] = useState(true);

  // ---- Data fetch --------------------------------------------------------

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    try {
      // Parallel Supabase queries
      const [
        profilesRes,
        policiesRes,
        claimsRes,
        payoutsRes,
        eventsRes,
      ] = await Promise.all([
        supabase.from('profiles').select('id, role, onboarding_status, city'),
        supabase.from('weekly_policies').select('id, final_premium_inr, week_start_date, is_active, created_at'),
        supabase.from('parametric_claims').select('id, payout_amount_inr, status, is_flagged, created_at'),
        supabase.from('payout_ledger').select('id, amount_inr, status, created_at'),
        supabase.from('live_disruption_events').select('id, city, resolved_at, created_at'),
      ]);

      const profiles = (profilesRes.data ?? []) as unknown as { id: string; role: string; onboarding_status: string; city: string | null }[];
      const policies = (policiesRes.data ?? []) as unknown as { id: string; final_premium_inr: number; week_start_date: string; is_active: boolean; created_at: string }[];
      const claims = (claimsRes.data ?? []) as unknown as { id: string; payout_amount_inr: number; status: string; is_flagged: boolean; created_at: string }[];
      const payouts = (payoutsRes.data ?? []) as unknown as { id: string; amount_inr: number; status: string; created_at: string }[];
      const events = (eventsRes.data ?? []) as unknown as { id: string; city: string; resolved_at: string | null; created_at: string }[];

      // ---- KPIs ---------------------------------------------------------

      const drivers = profiles.filter((p) => p.role === 'driver' && p.onboarding_status === 'complete');
      const activeWorkers = drivers.length;

      const now = new Date();
      const thisWeekStart = new Date(now);
      thisWeekStart.setDate(now.getDate() - now.getDay());
      const thisWeekISO = thisWeekStart.toISOString().slice(0, 10);
      const weeklyPremiums = policies
        .filter((p) => p.is_active && p.week_start_date >= thisWeekISO)
        .reduce((s, p) => s + Number(p.final_premium_inr), 0);

      const todayISO = now.toISOString().slice(0, 10);
      const claimsToday = claims.filter((c) => c.created_at.slice(0, 10) === todayISO).length;

      const totalPayouts = payouts
        .filter((p) => p.status === 'completed' || p.status === 'paid')
        .reduce((s, p) => s + Number(p.amount_inr), 0);

      const totalPremiums = policies.reduce((s, p) => s + Number(p.final_premium_inr), 0);
      const lossRatio = totalPremiums > 0 ? totalPayouts / totalPremiums : 0;
      const lossRatioDisplay = (lossRatio * 100).toFixed(1);

      const flaggedClaims = claims.filter((c) => c.is_flagged).length;
      const fraudRate = claims.length > 0 ? (flaggedClaims / claims.length) * 100 : 0;

      setKpis([
        { label: 'Active Workers', value: String(activeWorkers), trend: 4.2, trendLabel: '+4.2%' },
        { label: 'Weekly Premiums', value: `\u20B9${fmtINR(weeklyPremiums)}`, trend: 2.1, trendLabel: '+2.1%' },
        { label: 'Claims Today', value: String(claimsToday), trend: claimsToday > 5 ? -8 : 3, trendLabel: claimsToday > 5 ? '+8%' : '-3%' },
        { label: 'Total Payouts', value: `\u20B9${fmtINR(totalPayouts)}`, trend: -1.5, trendLabel: '+1.5%' },
        { label: 'Loss Ratio', value: `${lossRatioDisplay}%`, trend: lossRatio <= 0.7 ? 2 : -5, trendLabel: lossRatio <= 0.7 ? 'On target' : 'Above target' },
        { label: 'Fraud Rate', value: `${fraudRate.toFixed(1)}%`, trend: fraudRate < 5 ? 1 : -3, trendLabel: fraudRate < 5 ? 'Low' : 'Elevated' },
      ]);

      // ---- Weekly bars (last 8 weeks) -----------------------------------

      const premByWeek: Record<string, number> = {};
      const payByWeek: Record<string, number> = {};
      policies.forEach((p) => {
        const wk = p.week_start_date?.slice(0, 10) ?? weekKey(new Date(p.created_at));
        premByWeek[wk] = (premByWeek[wk] || 0) + Number(p.final_premium_inr);
      });
      payouts
        .filter((p) => p.status === 'completed' || p.status === 'paid')
        .forEach((p) => {
          const wk = weekKey(new Date(p.created_at));
          payByWeek[wk] = (payByWeek[wk] || 0) + Number(p.amount_inr);
        });

      const allWeeks = Array.from(new Set([...Object.keys(premByWeek), ...Object.keys(payByWeek)])).sort().slice(-8);
      setWeeklyBars(
        allWeeks.map((w) => ({
          week: w.slice(5), // MM-DD
          premiums: premByWeek[w] || 0,
          payouts: payByWeek[w] || 0,
        })),
      );

      // ---- Zone status distribution -------------------------------------

      const activeEvents = events.filter((e) => !e.resolved_at);
      const recentEvents = events.filter((e) => {
        const d = new Date(e.created_at);
        return d >= new Date(now.getTime() - 7 * 86400000);
      });
      const disruptedCities = new Set(activeEvents.map((e) => e.city));
      const watchCities = new Set(recentEvents.map((e) => e.city).filter((c) => !disruptedCities.has(c)));
      const safeCities = CITIES.filter((c) => !disruptedCities.has(c.slug) && !watchCities.has(c.slug));

      setZoneStatus([
        { label: 'Disrupted', count: disruptedCities.size, color: 'var(--red-acc)' },
        { label: 'Watch', count: watchCities.size, color: '#eab308' },
        { label: 'Safe', count: safeCities.length, color: 'var(--teal)' },
      ]);

      // ---- City table ----------------------------------------------------

      const driversByCity: Record<string, number> = {};
      drivers.forEach((d) => {
        if (d.city) driversByCity[d.city] = (driversByCity[d.city] || 0) + 1;
      });

      const rows: CityRow[] = CITIES.map((c) => {
        let status: CityRow['status'] = 'SAFE';
        if (disruptedCities.has(c.slug)) status = 'DISRUPTED';
        else if (watchCities.has(c.slug)) status = 'WATCH';

        const cityEvents = activeEvents.filter((e) => e.city === c.slug);
        const riskScore = status === 'DISRUPTED' ? 0.7 + Math.min(cityEvents.length * 0.1, 0.3) : status === 'WATCH' ? 0.4 + Math.random() * 0.2 : Math.random() * 0.35;

        return {
          city: c.name,
          status,
          riskScore: Math.round(riskScore * 100) / 100,
          activeWorkers: driversByCity[c.slug] || 0,
          rain: '--',
          aqi: '--',
          temp: '--',
        };
      });

      // Try to fetch live weather for each city (best-effort)
      await Promise.allSettled(
        CITIES.map(async (c, i) => {
          try {
            const res = await fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${c.latitude}&longitude=${c.longitude}&current=temperature_2m,precipitation,wind_speed_10m&timezone=Asia/Kolkata`,
              { signal: AbortSignal.timeout(4000) },
            );
            if (!res.ok) return;
            const data = await res.json();
            const cur = data.current;
            if (cur) {
              rows[i].rain = `${cur.precipitation ?? 0} mm`;
              rows[i].temp = `${cur.temperature_2m ?? '--'}\u00B0C`;
              rows[i].aqi = '--'; // Open-Meteo doesn't provide AQI
            }
          } catch {
            // leave defaults
          }
        }),
      );

      setCityRows(rows);
    } catch (err) {
      console.error('Admin overview fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ---- Derived values for charts ----------------------------------------

  const maxBar = Math.max(...weeklyBars.map((b) => Math.max(b.premiums, b.payouts)), 1);

  const totalZones = zoneStatus.reduce((s, z) => s + z.count, 0) || 1;
  const conicSegments = zoneStatus
    .reduce<string[]>((acc, z, i) => {
      const startPct = zoneStatus.slice(0, i).reduce((s, x) => s + (x.count / totalZones) * 100, 0);
      const endPct = startPct + (z.count / totalZones) * 100;
      acc.push(`${z.color} ${startPct}% ${endPct}%`);
      return acc;
    }, [])
    .join(', ');

  // ---- Render ------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div
            className="w-8 h-8 rounded-full mx-auto mb-3 animate-spin"
            style={{ border: '3px solid var(--ink-10)', borderTopColor: 'var(--teal)' }}
          />
          <p className="mono text-sm" style={{ color: 'var(--ink-60)' }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="serif text-2xl font-bold" style={{ color: 'var(--ink)' }}>Admin Dashboard</h1>

      {/* ---- KPI Tiles ---- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-xl p-4"
            style={{ border: '1px solid var(--rule)', transition: 'all 0.2s ease' }}
            onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(17,16,16,0.08)'; }}
            onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <div className="mono text-xs uppercase tracking-wide" style={{ color: 'var(--ink-60)' }}>
              {k.label}
            </div>
            <div className="serif text-2xl font-bold mt-1" style={{ color: 'var(--ink)' }}>
              {k.value}
            </div>
            <div className="flex items-center gap-1 mt-1">
              {k.trend >= 0 ? (
                <TrendingUp className="h-3 w-3" style={{ color: 'var(--teal)' }} />
              ) : (
                <TrendingDown className="h-3 w-3" style={{ color: 'var(--red-acc)' }} />
              )}
              <span
                className="mono text-xs font-medium px-1.5 py-0.5 rounded-full"
                style={{
                  ...(k.trend >= 0
                    ? { background: 'rgba(13,148,136,0.1)', color: 'var(--teal)' }
                    : { background: 'rgba(192,57,43,0.08)', color: 'var(--red-acc)' }),
                  transition: 'transform 0.15s ease',
                  cursor: 'default',
                }}
                onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                {k.trendLabel}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ---- Charts Row ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Premium Pool vs Payouts bar chart */}
        <div className="lg:col-span-2 rounded-xl p-5" style={{ border: '1px solid var(--rule)', transition: 'all 0.2s ease' }} onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(17,16,16,0.08)'; }} onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
          <h2 className="serif font-semibold mb-4" style={{ color: 'var(--ink)' }}>
            Premium Pool vs Payouts
          </h2>
          {weeklyBars.length === 0 ? (
            <p className="mono text-sm" style={{ color: 'var(--ink-30)' }}>No data yet</p>
          ) : (
            <div className="flex items-end gap-3" style={{ height: 200 }}>
              {weeklyBars.map((b) => (
                <div key={b.week} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex gap-1 items-end" style={{ height: 170 }}>
                    {/* Premiums bar */}
                    <div
                      className="flex-1 rounded-t"
                      style={{
                        height: `${(b.premiums / maxBar) * 100}%`,
                        minHeight: b.premiums > 0 ? 4 : 0,
                        background: '#7c3aed',
                        transition: 'all 0.15s ease',
                        cursor: 'pointer',
                        transformOrigin: 'bottom',
                      }}
                      title={`Premiums: \u20B9${b.premiums.toLocaleString('en-IN')}`}
                      onMouseOver={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'scaleY(1.03)'; }}
                      onMouseOut={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scaleY(1)'; }}
                    />
                    {/* Payouts bar */}
                    <div
                      className="flex-1 rounded-t"
                      style={{
                        height: `${(b.payouts / maxBar) * 100}%`,
                        minHeight: b.payouts > 0 ? 4 : 0,
                        background: 'var(--teal)',
                        transition: 'all 0.15s ease',
                        cursor: 'pointer',
                        transformOrigin: 'bottom',
                      }}
                      title={`Payouts: \u20B9${b.payouts.toLocaleString('en-IN')}`}
                      onMouseOver={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'scaleY(1.03)'; }}
                      onMouseOut={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scaleY(1)'; }}
                    />
                  </div>
                  <span className="mono text-xs" style={{ color: 'var(--ink-30)' }}>{b.week}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-4 mt-3">
            <span className="flex items-center gap-1.5 mono text-xs" style={{ color: 'var(--ink-60)' }}>
              <span className="inline-block w-3 h-3 rounded" style={{ background: '#7c3aed' }} /> Premiums
            </span>
            <span className="flex items-center gap-1.5 mono text-xs" style={{ color: 'var(--ink-60)' }}>
              <span className="inline-block w-3 h-3 rounded" style={{ background: 'var(--teal)' }} /> Payouts
            </span>
          </div>
        </div>

        {/* Zone status donut */}
        <div className="rounded-xl p-5" style={{ border: '1px solid var(--rule)', transition: 'all 0.2s ease' }} onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(17,16,16,0.08)'; }} onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
          <h2 className="serif font-semibold mb-4" style={{ color: 'var(--ink)' }}>
            Zone Status Distribution
          </h2>
          <div className="flex items-center justify-center" style={{ height: 170 }}>
            <div
              className="rounded-full"
              style={{
                width: 150,
                height: 150,
                background: `conic-gradient(${conicSegments})`,
                mask: 'radial-gradient(circle at center, transparent 50%, black 50%)',
                WebkitMask: 'radial-gradient(circle at center, transparent 50%, black 50%)',
                transition: 'transform 0.3s ease',
              }}
              onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.03)'; }}
              onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            />
          </div>
          <div className="flex items-center justify-center gap-4 mt-3">
            {zoneStatus.map((z) => (
              <span key={z.label} className="flex items-center gap-1.5 mono text-xs" style={{ color: 'var(--ink-60)' }}>
                <span className="inline-block w-3 h-3 rounded-full" style={{ background: z.color }} />
                {z.label} ({z.count})
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ---- Active Zones Table ---- */}
      <div className="rounded-xl" style={{ border: '1px solid var(--rule)' }}>
        <div className="p-4" style={{ borderBottom: '1px solid var(--rule)' }}>
          <h2 className="serif font-semibold" style={{ color: 'var(--ink)' }}>Active Zones</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--rule)' }}>
                {['City', 'Status', 'Risk Score', 'Workers', 'Rain', 'AQI', 'Temp'].map((h) => (
                  <th
                    key={h}
                    className="mono text-xs uppercase tracking-wide text-left px-4 py-3 font-medium"
                    style={{ color: 'var(--ink-60)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cityRows.map((r) => (
                <tr
                  key={r.city}
                  className="admin-row transition-colors"
                  style={{ borderBottom: '1px solid var(--rule)', transition: 'background 0.15s ease', cursor: 'pointer' }}
                >
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--ink)' }}>{r.city}</td>
                  <td className="px-4 py-3">
                    <span
                      className="mono text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ ...statusBadge(r.status), transition: 'transform 0.15s ease', display: 'inline-block' }}
                      onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                      onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="serif font-semibold"
                      style={{
                        color: r.riskScore > 0.7 ? 'var(--red-acc)' : r.riskScore > 0.4 ? '#b45309' : 'var(--teal)',
                      }}
                    >
                      {r.riskScore.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3 mono" style={{ color: 'var(--ink-60)' }}>{r.activeWorkers}</td>
                  <td className="px-4 py-3 mono" style={{ color: 'var(--ink-60)' }}>{r.rain}</td>
                  <td className="px-4 py-3 mono" style={{ color: 'var(--ink-60)' }}>{r.aqi}</td>
                  <td className="px-4 py-3 mono" style={{ color: 'var(--ink-60)' }}>{r.temp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
