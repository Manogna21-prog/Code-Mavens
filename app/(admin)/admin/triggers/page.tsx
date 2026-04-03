'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CITIES } from '@/lib/config/cities';
import { DISRUPTION_TYPES, TRIGGERS } from '@/lib/config/constants';
import type { DisruptionType } from '@/lib/config/constants';

/* ---------- Types ---------- */

interface TriggerEvent {
  id: string;
  event_type: string;
  city: string;
  severity_score: number;
  trigger_value: number | null;
  trigger_threshold: number | null;
  data_sources: string[] | null;
  resolved_at: string | null;
  created_at: string;
}

interface TriggerResult {
  status: string;
  event_id?: string;
  message?: string;
  claims_created?: number;
  payouts_completed?: number;
  error?: string;
}

/* ---------- Constants ---------- */

const TYPE_COLORS: Record<string, { border: string; color: string }> = {
  heavy_rainfall: { border: '1px solid var(--teal)', color: 'var(--teal)' },
  aqi_grap_iv: { border: '1px solid var(--ink-60)', color: 'var(--ink-60)' },
  cyclone: { border: '1px solid var(--red-acc)', color: 'var(--red-acc)' },
  platform_outage: { border: '1px solid var(--ink-60)', color: 'var(--ink-60)' },
  curfew_bandh: { border: '1px solid var(--red-acc)', color: 'var(--red-acc)' },
};

const TYPE_DONUT_COLORS: Record<string, string> = {
  heavy_rainfall: 'var(--teal)',
  aqi_grap_iv: '#6b7280',
  cyclone: 'var(--red-acc)',
  platform_outage: '#f59e0b',
  curfew_bandh: '#8b5cf6',
};

/* ---------- Skeleton ---------- */

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded ${className}`}
      style={{ background: 'var(--ink-10)' }}
    />
  );
}

/* ---------- Page ---------- */

export default function AdminTriggersPage() {
  const [events, setEvents] = useState<TriggerEvent[]>([]);
  const [claimCounts, setClaimCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterCity, setFilterCity] = useState('all');
  const [filterType, setFilterType] = useState('all');

  // Demo trigger state
  const [demoCity, setDemoCity] = useState(CITIES[0].slug);
  const [demoEventType, setDemoEventType] = useState<DisruptionType>(DISRUPTION_TYPES[0]);
  const [demoSeverity, setDemoSeverity] = useState(7);
  const [demoTriggerValue, setDemoTriggerValue] = useState('');
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoResult, setDemoResult] = useState<TriggerResult | null>(null);

  const triggerConfig = TRIGGERS[demoEventType];

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data: eventsData, error: eventsErr } = await supabase
          .from('live_disruption_events')
          .select('*')
          .order('created_at', { ascending: false });

        if (eventsErr) throw eventsErr;
        const allEvents = (eventsData as unknown as TriggerEvent[]) || [];
        setEvents(allEvents);

        // Claim counts
        const eventIds = allEvents.map((e) => e.id);
        if (eventIds.length > 0) {
          const { data: claimsData } = await supabase
            .from('parametric_claims')
            .select('disruption_event_id')
            .in('disruption_event_id', eventIds);

          const counts: Record<string, number> = {};
          for (const c of (claimsData || []) as unknown as { disruption_event_id: string }[]) {
            counts[c.disruption_event_id] = (counts[c.disruption_event_id] || 0) + 1;
          }
          setClaimCounts(counts);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load triggers');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  /* --- Computed analytics --- */

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of events) {
      counts[e.event_type] = (counts[e.event_type] || 0) + 1;
    }
    return counts;
  }, [events]);

  const cityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of events) {
      counts[e.city] = (counts[e.city] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [events]);

  const cityMaxCount = cityCounts.length > 0 ? cityCounts[0][1] : 1;

  // City-trigger heatmap data
  const heatmapData = useMemo(() => {
    const cities = [...new Set(events.map((e) => e.city))].sort();
    const types = DISRUPTION_TYPES as readonly string[];
    const matrix: Record<string, Record<string, number>> = {};
    for (const city of cities) {
      matrix[city] = {};
      for (const t of types) matrix[city][t] = 0;
    }
    for (const e of events) {
      if (matrix[e.city]) matrix[e.city][e.event_type] = (matrix[e.city][e.event_type] || 0) + 1;
    }
    let maxVal = 1;
    for (const row of Object.values(matrix)) {
      for (const v of Object.values(row)) {
        if (v > maxVal) maxVal = v;
      }
    }
    return { cities, types, matrix, maxVal };
  }, [events]);

  // Donut gradient
  const donutGradient = useMemo(() => {
    const total = events.length || 1;
    const segments: string[] = [];
    let cumulative = 0;
    for (const dt of DISRUPTION_TYPES) {
      const count = typeCounts[dt] || 0;
      const pct = (count / total) * 100;
      const color = TYPE_DONUT_COLORS[dt] || '#ccc';
      segments.push(`${color} ${cumulative}% ${cumulative + pct}%`);
      cumulative += pct;
    }
    return `conic-gradient(${segments.join(', ')})`;
  }, [events.length, typeCounts]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (filterCity !== 'all' && e.city !== filterCity) return false;
      if (filterType !== 'all' && e.event_type !== filterType) return false;
      return true;
    });
  }, [events, filterCity, filterType]);

  // Unique cities from events
  const eventCities = useMemo(() => [...new Set(events.map((e) => e.city))].sort(), [events]);

  /* --- Demo trigger handler --- */

  async function handleFireTrigger() {
    setDemoLoading(true);
    setDemoResult(null);
    try {
      const body: Record<string, unknown> = {
        city: demoCity,
        event_type: demoEventType,
        severity: demoSeverity,
      };
      if (demoTriggerValue) body.trigger_value = Number(demoTriggerValue);

      const res = await fetch('/api/admin/demo-trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as TriggerResult;
      setDemoResult(data);

      // Reload events after firing
      if (!data.error) {
        const supabase = createClient();
        const { data: refreshed } = await supabase
          .from('live_disruption_events')
          .select('*')
          .order('created_at', { ascending: false });
        if (refreshed) setEvents(refreshed as unknown as TriggerEvent[]);
      }
    } catch (err) {
      setDemoResult({ status: 'error', error: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setDemoLoading(false);
    }
  }

  /* --- Loading / Error --- */

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="serif text-2xl font-bold">Trigger Events</h1>
        <div className="rounded-2xl p-5" style={{ background: 'rgba(192,57,43,0.06)', border: '1px solid var(--red-acc)' }}>
          <p className="font-medium" style={{ color: 'var(--red-acc)' }}>Failed to load data</p>
          <p className="text-sm mt-1" style={{ color: 'var(--red-acc)' }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="serif text-2xl font-bold">Trigger Events</h1>

      {/* --- Trigger Analytics Summary --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Triggers KPI */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--cream)', border: '1px solid var(--rule)', transition: 'all 0.2s ease' }} onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(17,16,16,0.08)'; }} onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
          <p className="mono text-xs uppercase tracking-wide" style={{ color: 'var(--ink-60)' }}>Total Triggers Fired</p>
          <p className="serif text-3xl font-bold mt-2" style={{ color: 'var(--ink)' }}>{events.length}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--ink-30)' }}>
            {events.filter((e) => !e.resolved_at).length} active
          </p>
        </div>

        {/* Type Distribution - Donut */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--cream)', border: '1px solid var(--rule)', transition: 'all 0.2s ease' }} onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(17,16,16,0.08)'; }} onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
          <p className="mono text-xs uppercase tracking-wide mb-3" style={{ color: 'var(--ink-60)' }}>By Type</p>
          <div className="flex items-center gap-4">
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: donutGradient,
                position: 'relative',
                flexShrink: 0,
                transition: 'transform 0.3s ease',
              }}
              onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.03)'; }}
              onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%,-50%)',
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'var(--cream)',
                }}
              />
            </div>
            <div className="space-y-1 text-xs min-w-0">
              {DISRUPTION_TYPES.map((dt) => (
                <div key={dt} className="flex items-center gap-1.5">
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: TYPE_DONUT_COLORS[dt],
                      flexShrink: 0,
                      display: 'inline-block',
                    }}
                  />
                  <span className="mono truncate" style={{ color: 'var(--ink-60)' }}>
                    {TRIGGERS[dt].label}: {typeCounts[dt] || 0}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* City Bar Chart */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--cream)', border: '1px solid var(--rule)', transition: 'all 0.2s ease' }} onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(17,16,16,0.08)'; }} onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
          <p className="mono text-xs uppercase tracking-wide mb-3" style={{ color: 'var(--ink-60)' }}>By City</p>
          <div className="space-y-2">
            {cityCounts.slice(0, 6).map(([city, count]) => (
              <div key={city} className="flex items-center gap-2">
                <span className="mono text-xs w-20 truncate" style={{ color: 'var(--ink-60)' }}>{city}</span>
                <div className="flex-1 h-4 rounded" style={{ background: 'var(--ink-10)' }}>
                  <div
                    className="h-full rounded"
                    style={{
                      width: `${(count / cityMaxCount) * 100}%`,
                      background: 'var(--teal)',
                      minWidth: 4,
                      transition: 'all 0.15s ease',
                      cursor: 'pointer',
                      transformOrigin: 'left',
                    }}
                    onMouseOver={e => { e.currentTarget.style.transform = 'scaleX(1.02)'; e.currentTarget.style.opacity = '0.85'; }}
                    onMouseOut={e => { e.currentTarget.style.transform = 'scaleX(1)'; e.currentTarget.style.opacity = '1'; }}
                  />
                </div>
                <span className="serif text-xs font-medium w-6 text-right" style={{ color: 'var(--ink)' }}>{count}</span>
              </div>
            ))}
            {cityCounts.length === 0 && (
              <p className="text-xs" style={{ color: 'var(--ink-30)' }}>No data</p>
            )}
          </div>
        </div>
      </div>

      {/* --- City-Trigger Heatmap --- */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--cream)', border: '1px solid var(--rule)' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--rule)' }}>
          <h2 className="serif text-lg font-bold" style={{ color: 'var(--ink)' }}>City-Trigger Heatmap</h2>
        </div>
        <div className="overflow-x-auto p-5">
          {heatmapData.cities.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left mono text-xs font-medium" style={{ color: 'var(--ink-60)' }}>City</th>
                  {heatmapData.types.map((t) => (
                    <th key={t} className="px-3 py-2 text-center mono text-xs font-medium" style={{ color: 'var(--ink-60)' }}>
                      {t === 'heavy_rainfall' ? 'Rainfall' : t === 'aqi_grap_iv' ? 'AQI' : t === 'platform_outage' ? 'Outage' : t === 'curfew_bandh' ? 'Curfew' : TRIGGERS[t as DisruptionType]?.label.split(' ')[0] || t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmapData.cities.map((city) => (
                  <tr key={city} style={{ borderTop: '1px solid var(--ink-10)', transition: 'background 0.15s ease', cursor: 'pointer' }}>
                    <td className="px-3 py-2 font-medium" style={{ color: 'var(--ink)' }}>{city}</td>
                    {heatmapData.types.map((t) => {
                      const val = heatmapData.matrix[city][t];
                      const intensity = val / heatmapData.maxVal;
                      return (
                        <td key={t} className="px-3 py-2 text-center">
                          <div
                            className="inline-flex items-center justify-center rounded"
                            style={{
                              width: 40,
                              height: 28,
                              background: val > 0
                                ? `rgba(13,148,136,${0.1 + intensity * 0.6})`
                                : 'var(--ink-10)',
                              color: val > 0 ? 'var(--teal-d)' : 'var(--ink-30)',
                              transition: 'transform 0.15s ease',
                              cursor: 'pointer',
                            }}
                            onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.1)'; }}
                            onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                          >
                            <span className="serif text-xs font-bold">{val}</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-center py-6" style={{ color: 'var(--ink-30)' }}>No trigger events to display</p>
          )}
        </div>
      </div>

      {/* --- Trigger History Table --- */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--cream)', border: '1px solid var(--rule)' }}>
        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" style={{ borderBottom: '1px solid var(--rule)' }}>
          <h2 className="serif text-lg font-bold" style={{ color: 'var(--ink)' }}>Trigger History</h2>
          <div className="flex gap-2 flex-wrap">
            <select
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              className="mono text-xs rounded-lg px-3 py-1.5"
              style={{ border: '1px solid var(--rule)', background: 'var(--cream)' }}
            >
              <option value="all">All Cities</option>
              {eventCities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="mono text-xs rounded-lg px-3 py-1.5"
              style={{ border: '1px solid var(--rule)', background: 'var(--cream)' }}
            >
              <option value="all">All Types</option>
              {DISRUPTION_TYPES.map((dt) => (
                <option key={dt} value={dt}>{TRIGGERS[dt].label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ background: 'var(--cream-d)', color: 'var(--ink-60)' }}>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">City</th>
                <th className="px-4 py-3 font-medium">Severity</th>
                <th className="px-4 py-3 font-medium">Value / Threshold</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Claims</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((event) => {
                const eventType = event.event_type as DisruptionType;
                const trigger = TRIGGERS[eventType];
                const typeStyle = TYPE_COLORS[event.event_type] || { border: '1px solid var(--ink-60)', color: 'var(--ink-60)' };
                const isActive = !event.resolved_at;
                const time = new Date(event.created_at).toLocaleString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <tr key={event.id} className="admin-row" style={{ borderTop: '1px solid var(--ink-10)', transition: 'background 0.15s ease', cursor: 'pointer' }}>
                    <td className="mono px-4 py-3 text-xs" style={{ color: 'var(--ink-60)' }}>{time}</td>
                    <td className="px-4 py-3">
                      <span className="mono text-xs font-medium px-2 py-1 rounded-full" style={{ ...typeStyle, transition: 'transform 0.15s ease', display: 'inline-block' }} onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.05)'; }} onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; }}>
                        {trigger?.label || event.event_type}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--ink)' }}>{event.city}</td>
                    <td className="serif px-4 py-3 font-medium">{event.severity_score.toFixed(1)}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--ink-60)' }}>
                      {event.trigger_value ?? '-'} / {event.trigger_threshold ?? '-'}
                      {trigger && <span className="text-xs ml-1" style={{ color: 'var(--ink-30)' }}>{trigger.unit}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="mono text-xs font-medium px-2 py-1 rounded-full"
                        style={{
                          border: isActive ? '1px solid var(--teal)' : '1px solid var(--ink-30)',
                          color: isActive ? 'var(--teal)' : 'var(--ink-30)',
                          transition: 'transform 0.15s ease',
                          display: 'inline-block',
                        }}
                        onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                        onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                      >
                        {isActive ? 'Active' : 'Resolved'}
                      </span>
                    </td>
                    <td className="serif px-4 py-3 font-medium">{claimCounts[event.id] || 0}</td>
                  </tr>
                );
              })}
              {filteredEvents.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center" style={{ color: 'var(--ink-30)' }}>
                    No trigger events found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- Demo Trigger Panel --- */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--cream)', border: '1px solid var(--rule)' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--rule)' }}>
          <h2 className="serif text-lg font-bold" style={{ color: 'var(--ink)' }}>Demo Trigger Panel</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-60)' }}>Inject synthetic disruption events for testing.</p>
        </div>
        <div className="p-5 space-y-5">
          {/* Row 1: City + Disruption Type */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label className="mono block text-sm font-medium mb-1" style={{ color: 'var(--ink)' }}>City</label>
              <select
                value={demoCity}
                onChange={(e) => setDemoCity(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ border: '1px solid var(--rule)', background: 'var(--cream)' }}
              >
                {CITIES.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name} ({c.state})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mono block text-sm font-medium mb-1" style={{ color: 'var(--ink)' }}>Disruption Type</label>
              <select
                value={demoEventType}
                onChange={(e) => setDemoEventType(e.target.value as DisruptionType)}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ border: '1px solid var(--rule)', background: 'var(--cream)' }}
              >
                {DISRUPTION_TYPES.map((dt) => (
                  <option key={dt} value={dt}>{TRIGGERS[dt].label}</option>
                ))}
              </select>
              <p className="text-xs mt-1" style={{ color: 'var(--ink-30)' }}>{triggerConfig.description}</p>
            </div>
          </div>

          {/* Row 2: Severity + Trigger Value */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label className="mono block text-sm font-medium mb-1" style={{ color: 'var(--ink)' }}>
                Severity: {demoSeverity.toFixed(1)}
              </label>
              <input
                type="range"
                min={0}
                max={10}
                step={0.1}
                value={demoSeverity}
                onChange={(e) => setDemoSeverity(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs" style={{ color: 'var(--ink-30)' }}>
                <span>0</span><span>5</span><span>10</span>
              </div>
            </div>

            <div>
              <label className="mono block text-sm font-medium mb-1" style={{ color: 'var(--ink)' }}>
                Trigger Value ({triggerConfig.unit})
              </label>
              <input
                type="number"
                value={demoTriggerValue}
                onChange={(e) => setDemoTriggerValue(e.target.value)}
                placeholder={`Threshold: ${triggerConfig.threshold}`}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ border: '1px solid var(--rule)', background: 'var(--cream)' }}
              />
              <p className="text-xs mt-1" style={{ color: 'var(--ink-30)' }}>
                Leave empty for default ({triggerConfig.threshold * 1.5} {triggerConfig.unit})
              </p>
            </div>
          </div>

          <button
            onClick={handleFireTrigger}
            disabled={demoLoading}
            className="w-full text-white font-medium py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ background: 'var(--red-acc)', transition: 'all 0.2s ease' }}
            onMouseOver={e => { if (!demoLoading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(192,57,43,0.3)'; } }}
            onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            {demoLoading ? 'Firing...' : 'Fire Trigger'}
          </button>
        </div>

        {demoResult && (
          <div className="px-5 pb-5">
            <div
              className="rounded-xl p-4"
              style={
                demoResult.error
                  ? { background: 'rgba(192,57,43,0.06)', border: '1px solid var(--red-acc)' }
                  : { background: 'var(--teal-bg)', border: '1px solid var(--teal)' }
              }
            >
              {demoResult.error ? (
                <div style={{ color: 'var(--red-acc)' }}>
                  <div className="font-medium">Error</div>
                  <div className="text-sm">{demoResult.error}</div>
                </div>
              ) : (
                <div style={{ color: 'var(--teal)' }}>
                  <div className="font-medium">Trigger Fired</div>
                  <div className="text-sm">{demoResult.message}</div>
                  {demoResult.event_id && (
                    <div className="mono text-xs mt-1" style={{ color: 'var(--teal-d)' }}>
                      Event ID: {demoResult.event_id}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
