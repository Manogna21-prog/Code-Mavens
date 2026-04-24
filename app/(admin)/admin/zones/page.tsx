'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CITIES } from '@/lib/config/cities';
import { H3_RESOLUTION, disk } from '@/lib/utils/h3';
import { Activity, Users, AlertTriangle, RefreshCw, MapPin } from 'lucide-react';
import type { RiderPoint, EventOverlay } from '@/components/admin/ZoneH3Map';

// Leaflet touches window; load the map only on the client.
const ZoneH3Map = dynamic(() => import('@/components/admin/ZoneH3Map'), { ssr: false });

const F = "var(--font-inter),'Inter',sans-serif";
const M = "var(--font-ibm-plex-mono),'IBM Plex Mono',monospace";

// Only consider heartbeats this recent as "currently active"
const RECENT_ACTIVITY_MINUTES = 30;

interface ActivityRow {
  profile_id: string;
  latitude: number | null;
  longitude: number | null;
  h3_cell: string | null;
  status: string;
  recorded_at: string;
  profiles: { full_name: string | null } | null;
}

interface EventRow {
  id: string;
  event_type: string;
  center_h3_cell: string | null;
  h3_ring_size: number | null;
  severity_score: number;
  resolved_at: string | null;
  city: string;
  zone_latitude: number | null;
  zone_longitude: number | null;
}

export default function AdminZonesPage() {
  const [city, setCity] = useState<string>(CITIES[0].slug);
  const [riders, setRiders] = useState<RiderPoint[]>([]);
  const [events, setEvents] = useState<EventOverlay[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const cityMeta = useMemo(() => CITIES.find((c) => c.slug === city) ?? CITIES[0], [city]);
  const mapCenter: [number, number] = [cityMeta.latitude, cityMeta.longitude];

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const since = new Date(Date.now() - RECENT_ACTIVITY_MINUTES * 60 * 1000).toISOString();

    async function load() {
      const [logsRes, eventsRes] = await Promise.all([
        supabase
          .from('driver_activity_logs')
          .select('profile_id, latitude, longitude, h3_cell, status, recorded_at, profiles(full_name)')
          .gte('recorded_at', since)
          .neq('status', 'offline')
          .order('recorded_at', { ascending: false })
          .limit(2000),
        supabase
          .from('live_disruption_events')
          .select('id, event_type, center_h3_cell, h3_ring_size, severity_score, resolved_at, city, zone_latitude, zone_longitude')
          .is('resolved_at', null)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (cancelled) return;

      // Dedupe rider rows — keep only the most recent heartbeat per profile.
      const latestByProfile = new Map<string, ActivityRow>();
      for (const row of (logsRes.data as unknown as ActivityRow[]) || []) {
        if (!latestByProfile.has(row.profile_id)) latestByProfile.set(row.profile_id, row);
      }

      const points: RiderPoint[] = [];
      for (const row of latestByProfile.values()) {
        if (row.h3_cell == null || row.latitude == null || row.longitude == null) continue;
        points.push({
          profile_id: row.profile_id,
          name: row.profiles?.full_name ?? null,
          lat: row.latitude,
          lng: row.longitude,
          status: row.status,
          h3_cell: row.h3_cell,
          recorded_at: row.recorded_at,
        });
      }

      const evs: EventOverlay[] = [];
      for (const row of (eventsRes.data as unknown as EventRow[]) || []) {
        if (!row.center_h3_cell || row.h3_ring_size == null) continue;
        evs.push({
          id: row.id,
          event_type: row.event_type,
          center_h3_cell: row.center_h3_cell,
          h3_ring_size: row.h3_ring_size,
          severity_score: row.severity_score,
        });
      }

      setRiders(points);
      setEvents(evs);
      setLoading(false);
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    load();
    return () => { cancelled = true; };
  }, [city, tick]);

  // Riders currently inside any active disruption (eligible for payout if a new event fires).
  const affectedRiders = useMemo(() => {
    if (events.length === 0) return [];
    const affectedSet = new Set<string>();
    for (const e of events) affectedSet.add(e.center_h3_cell);
    for (const e of events) for (const c of disk(e.center_h3_cell, e.h3_ring_size)) affectedSet.add(c);
    return riders.filter((r) => affectedSet.has(r.h3_cell));
  }, [riders, events]);

  const activeCount = riders.filter((r) => r.status === 'on_trip').length;

  return (
    <div className="space-y-6">
      <style>{`
        @keyframes fSlide { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .f-s { animation: fSlide 0.4s ease both; }
        .f-s1{animation-delay:.05s} .f-s2{animation-delay:.1s} .f-s3{animation-delay:.15s}
      `}</style>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1A1A1A', letterSpacing: '-0.03em', fontFamily: F }}>Zone Map</h1>
          <p style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
            Live rider density on H3 res-{H3_RESOLUTION} hexagons (~920 m). Affected zones outlined in red.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 10, border: '1px solid #E8E8EA', fontSize: 12, fontFamily: M }}
          >
            {CITIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
          <button
            onClick={() => setTick((t) => t + 1)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #E8E8EA', background: '#fff', color: '#6B7280', cursor: 'pointer', fontFamily: M }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="f-s f-s1 grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active riders (30 min)', value: riders.length, gradient: 'linear-gradient(135deg, #6366F1, #8B5CF6)', icon: Users },
          { label: 'On trip right now', value: activeCount, gradient: 'linear-gradient(135deg, #22C55E, #16A34A)', icon: Activity },
          { label: 'Active disruptions', value: events.length, gradient: 'linear-gradient(135deg, #EF4444, #DC2626)', icon: AlertTriangle },
          { label: 'Riders in affected zones', value: affectedRiders.length, gradient: 'linear-gradient(135deg, #F97316, #FACC15)', icon: MapPin },
        ].map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} style={{ background: k.gradient, color: '#fff', borderRadius: 16, padding: 16, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -8, right: -8, width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
              <Icon size={16} style={{ opacity: 0.8, marginBottom: 4 }} />
              <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.85, fontFamily: M }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2, fontFamily: F }}>{k.value}</div>
            </div>
          );
        })}
      </div>

      {/* Map + riders panel */}
      <div className="f-s f-s2 grid grid-cols-1 lg:grid-cols-[1fr_minmax(280px,360px)] gap-4">
        <div>
          <ZoneH3Map
            center={mapCenter}
            zoom={11}
            riders={riders.filter((r) => approxCity(r.lat, r.lng, cityMeta.latitude, cityMeta.longitude))}
            events={events}
            resolutionLabel={`H3 res-${H3_RESOLUTION} · ~920m across`}
          />
        </div>

        <aside className="space-y-4">
          <div style={{ background: '#fff', border: '1px solid #E8E8EA', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: 1.2, fontFamily: M, textTransform: 'uppercase', marginBottom: 8 }}>
              Eligible riders (in active disruption)
            </div>
            {loading && <div style={{ fontSize: 11, color: '#9CA3AF' }}>Loading…</div>}
            {!loading && affectedRiders.length === 0 && (
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>No active disruptions right now, or no riders in affected hexes.</div>
            )}
            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              {affectedRiders.slice(0, 40).map((r) => (
                <div key={r.profile_id} style={{ padding: '8px 0', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A', fontFamily: F, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name ?? 'Unknown'}</div>
                    <div style={{ fontSize: 10, color: '#9CA3AF', fontFamily: M }}>{r.h3_cell}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 8, background: r.status === 'on_trip' ? 'rgba(34,197,94,0.12)' : 'rgba(59,130,246,0.1)', color: r.status === 'on_trip' ? '#16A34A' : '#2563EB', fontFamily: M }}>
                    {r.status}
                  </span>
                </div>
              ))}
              {affectedRiders.length > 40 && (
                <div style={{ fontSize: 10, color: '#9CA3AF', textAlign: 'center', marginTop: 8 }}>+{affectedRiders.length - 40} more</div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// Cheap city-filter helper (bounding-box, fine for display at metro scale).
function approxCity(lat: number, lng: number, cLat: number, cLng: number): boolean {
  return Math.abs(lat - cLat) < 0.6 && Math.abs(lng - cLng) < 0.6;
}
