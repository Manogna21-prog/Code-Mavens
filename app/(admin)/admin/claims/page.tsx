'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TRIGGERS } from '@/lib/config/constants';
import type { DisruptionType } from '@/lib/config/constants';

/* ---------- Types ---------- */

interface ClaimRow {
  id: string;
  profile_id: string;
  payout_amount_inr: number;
  status: string;
  fraud_score: number;
  is_flagged: boolean;
  flag_reason: string | null;
  fraud_signals: Record<string, unknown>;
  created_at: string;
  profiles: { full_name: string | null; city: string | null } | null;
  live_disruption_events: {
    event_type: string;
    city: string;
    severity_score: number;
  } | null;
}

/* ---------- Constants ---------- */

const STATUS_STYLES: Record<string, { border: string; color: string }> = {
  paid: { border: '1px solid var(--teal)', color: 'var(--teal)' },
  approved: { border: '1px solid var(--teal)', color: 'var(--teal)' },
  gate1_passed: { border: '1px solid #f59e0b', color: '#f59e0b' },
  gate2_passed: { border: '1px solid #f59e0b', color: '#f59e0b' },
  triggered: { border: '1px solid var(--ink-60)', color: 'var(--ink-60)' },
  pending_review: { border: '1px solid #f59e0b', color: '#f59e0b' },
  rejected: { border: '1px solid var(--red-acc)', color: 'var(--red-acc)' },
  appealed: { border: '1px solid var(--ink-60)', color: 'var(--ink-60)' },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const SEASONS: Record<string, string> = {
  'Dec': 'Winter', 'Jan': 'Winter', 'Feb': 'Winter',
  'Mar': 'Pre-Monsoon', 'Apr': 'Pre-Monsoon', 'May': 'Pre-Monsoon',
  'Jun': 'Monsoon', 'Jul': 'Monsoon', 'Aug': 'Monsoon', 'Sep': 'Monsoon',
  'Oct': 'Post-Monsoon', 'Nov': 'Post-Monsoon',
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

export default function AdminClaimsPage() {
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const loadClaims = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error: fetchErr } = await supabase
        .from('parametric_claims')
        .select('*, profiles(full_name, city), live_disruption_events(event_type, city, severity_score)')
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      setClaims((data as unknown as ClaimRow[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load claims');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClaims();
  }, [loadClaims]);

  /* --- Computed analytics --- */

  const kpis = useMemo(() => {
    let total = 0, paid = 0, rejected = 0, pending = 0;
    for (const c of claims) {
      total++;
      if (c.status === 'paid' || c.status === 'approved') paid++;
      else if (c.status === 'rejected') rejected++;
      else pending++;
    }
    return { total, paid, rejected, pending };
  }, [claims]);

  // Claims by zone (city)
  const zoneCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of claims) {
      const city = c.live_disruption_events?.city || c.profiles?.city || 'Unknown';
      counts[city] = (counts[city] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [claims]);

  const zoneMax = zoneCounts.length > 0 ? zoneCounts[0][1] : 1;

  // Claims by month
  const monthlyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of claims) {
      const d = new Date(c.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
      counts[key] = (counts[key] || 0) + 1;
    }
    const sorted = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
    return sorted;
  }, [claims]);

  const monthlyMax = monthlyCounts.length > 0 ? Math.max(...monthlyCounts.map((m) => m[1])) : 1;

  // Claims by season
  const seasonCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of claims) {
      const d = new Date(c.created_at);
      const monthName = MONTHS[d.getMonth()];
      const season = SEASONS[monthName] || 'Unknown';
      counts[season] = (counts[season] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [claims]);

  // Flagged claims
  const flaggedClaims = useMemo(() => claims.filter((c) => c.is_flagged), [claims]);

  // Filtered claims
  const filteredClaims = useMemo(() => {
    if (filterStatus === 'all') return claims;
    if (filterStatus === 'flagged') return claims.filter((c) => c.is_flagged);
    return claims.filter((c) => c.status === filterStatus);
  }, [claims, filterStatus]);

  /* --- Review handler --- */

  async function handleReview(claimId: string, action: 'approve' | 'reject') {
    setReviewingId(claimId);
    try {
      const res = await fetch('/api/admin/review-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim_id: claimId, action }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error || 'Review failed');
      }
      // Reload
      await loadClaims();
    } catch (err) {
      console.error('Review error:', err);
    } finally {
      setReviewingId(null);
    }
  }

  /* --- Fraud Score Gauge --- */

  function FraudGauge({ score }: { score: number }) {
    const pct = Math.min(score * 100, 100);
    const color = score >= 0.7 ? 'var(--red-acc)' : score >= 0.3 ? '#f59e0b' : 'var(--teal)';
    return (
      <div className="flex items-center gap-2">
        <div className="w-16 h-2 rounded-full" style={{ background: 'var(--ink-10)' }}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className="serif text-xs font-bold" style={{ color }}>{(score * 100).toFixed(0)}%</span>
      </div>
    );
  }

  /* --- Loading / Error --- */

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="serif text-2xl font-bold">Claim Center</h1>
        <div className="rounded-2xl p-5" style={{ background: 'rgba(192,57,43,0.06)', border: '1px solid var(--red-acc)' }}>
          <p className="font-medium" style={{ color: 'var(--red-acc)' }}>Failed to load data</p>
          <p className="text-sm mt-1" style={{ color: 'var(--red-acc)' }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="serif text-2xl font-bold">Claim Center</h1>

      {/* --- KPI Tiles --- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Claims', value: kpis.total, color: 'var(--ink)' },
          { label: 'Paid', value: kpis.paid, color: 'var(--teal)' },
          { label: 'Rejected', value: kpis.rejected, color: 'var(--red-acc)' },
          { label: 'Pending', value: kpis.pending, color: '#f59e0b' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-2xl p-5" style={{ background: 'var(--cream)', border: '1px solid var(--rule)', transition: 'all 0.2s ease' }} onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(17,16,16,0.08)'; }} onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
            <p className="mono text-xs uppercase tracking-wide" style={{ color: 'var(--ink-60)' }}>{kpi.label}</p>
            <p className="serif text-3xl font-bold mt-2" style={{ color: kpi.color }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* --- Claims Analytics Charts --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* By Zone */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--cream)', border: '1px solid var(--rule)', transition: 'all 0.2s ease' }} onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(17,16,16,0.08)'; }} onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
          <p className="mono text-xs uppercase tracking-wide mb-3" style={{ color: 'var(--ink-60)' }}>Claims by Zone</p>
          <div className="space-y-2">
            {zoneCounts.slice(0, 7).map(([zone, count]) => (
              <div key={zone} className="flex items-center gap-2">
                <span className="mono text-xs w-20 truncate" style={{ color: 'var(--ink-60)' }}>{zone}</span>
                <div className="flex-1 h-4 rounded" style={{ background: 'var(--ink-10)' }}>
                  <div className="h-full rounded" style={{ width: `${(count / zoneMax) * 100}%`, background: 'var(--teal)', minWidth: 4, transition: 'all 0.15s ease', cursor: 'pointer', transformOrigin: 'left' }} onMouseOver={e => { e.currentTarget.style.transform = 'scaleX(1.02)'; e.currentTarget.style.opacity = '0.85'; }} onMouseOut={e => { e.currentTarget.style.transform = 'scaleX(1)'; e.currentTarget.style.opacity = '1'; }} />
                </div>
                <span className="serif text-xs font-medium w-6 text-right" style={{ color: 'var(--ink)' }}>{count}</span>
              </div>
            ))}
            {zoneCounts.length === 0 && <p className="text-xs" style={{ color: 'var(--ink-30)' }}>No data</p>}
          </div>
        </div>

        {/* By Month - Vertical bars */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--cream)', border: '1px solid var(--rule)', transition: 'all 0.2s ease' }} onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(17,16,16,0.08)'; }} onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
          <p className="mono text-xs uppercase tracking-wide mb-3" style={{ color: 'var(--ink-60)' }}>Claims by Month</p>
          <div className="flex items-end gap-2 h-32">
            {monthlyCounts.map(([key, count]) => {
              const monthIdx = parseInt(key.split('-')[1], 10);
              const label = MONTHS[monthIdx] || key;
              const heightPct = (count / monthlyMax) * 100;
              return (
                <div key={key} className="flex-1 flex flex-col items-center gap-1">
                  <span className="serif text-xs font-medium" style={{ color: 'var(--ink)' }}>{count}</span>
                  <div className="w-full rounded-t" style={{ height: `${Math.max(heightPct, 4)}%`, background: 'var(--teal)', transition: 'all 0.15s ease', cursor: 'pointer', transformOrigin: 'bottom' }} onMouseOver={e => { e.currentTarget.style.transform = 'scaleY(1.03)'; e.currentTarget.style.opacity = '0.85'; }} onMouseOut={e => { e.currentTarget.style.transform = 'scaleY(1)'; e.currentTarget.style.opacity = '1'; }} />
                  <span className="mono text-xs" style={{ color: 'var(--ink-30)' }}>{label}</span>
                </div>
              );
            })}
            {monthlyCounts.length === 0 && (
              <p className="text-xs w-full text-center" style={{ color: 'var(--ink-30)' }}>No data</p>
            )}
          </div>
        </div>

        {/* By Season */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--cream)', border: '1px solid var(--rule)', transition: 'all 0.2s ease' }} onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(17,16,16,0.08)'; }} onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
          <p className="mono text-xs uppercase tracking-wide mb-3" style={{ color: 'var(--ink-60)' }}>Claims by Season</p>
          <div className="space-y-3">
            {seasonCounts.map(([season, count]) => {
              const seasonMax = seasonCounts.length > 0 ? seasonCounts[0][1] : 1;
              const seasonColors: Record<string, string> = {
                Monsoon: 'var(--teal)',
                Winter: '#6366f1',
                'Pre-Monsoon': '#f59e0b',
                'Post-Monsoon': '#8b5cf6',
              };
              return (
                <div key={season}>
                  <div className="flex justify-between mb-1">
                    <span className="mono text-xs" style={{ color: 'var(--ink-60)' }}>{season}</span>
                    <span className="serif text-xs font-medium" style={{ color: 'var(--ink)' }}>{count}</span>
                  </div>
                  <div className="h-3 rounded-full" style={{ background: 'var(--ink-10)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(count / seasonMax) * 100}%`,
                        background: seasonColors[season] || 'var(--teal)',
                        minWidth: 4,
                        transition: 'all 0.15s ease',
                        cursor: 'pointer',
                        transformOrigin: 'left',
                      }}
                      onMouseOver={e => { e.currentTarget.style.transform = 'scaleX(1.02)'; e.currentTarget.style.opacity = '0.85'; }}
                      onMouseOut={e => { e.currentTarget.style.transform = 'scaleX(1)'; e.currentTarget.style.opacity = '1'; }}
                    />
                  </div>
                </div>
              );
            })}
            {seasonCounts.length === 0 && <p className="text-xs" style={{ color: 'var(--ink-30)' }}>No data</p>}
          </div>
        </div>
      </div>

      {/* --- Fraud Detection Panel --- */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--cream)', border: '1px solid var(--rule)' }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--rule)' }}>
          <div>
            <h2 className="serif text-lg font-bold" style={{ color: 'var(--ink)' }}>Fraud Detection</h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--ink-60)' }}>
              {flaggedClaims.length} flagged claim{flaggedClaims.length !== 1 ? 's' : ''} requiring review
            </p>
          </div>
          {flaggedClaims.length > 0 && (
            <span
              className="mono text-xs font-medium px-3 py-1.5 rounded-full blink"
              style={{ border: '1px solid var(--red-acc)', color: 'var(--red-acc)', transition: 'transform 0.15s ease', display: 'inline-block' }}
              onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.05)'; }}
              onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              {flaggedClaims.length} flagged
            </span>
          )}
        </div>
        {flaggedClaims.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ background: 'var(--cream-d)', color: 'var(--ink-60)' }}>
                  <th className="px-4 py-3 font-medium">Driver</th>
                  <th className="px-4 py-3 font-medium">Event Type</th>
                  <th className="px-4 py-3 font-medium">Fraud Score</th>
                  <th className="px-4 py-3 font-medium">Flag Reason</th>
                  <th className="px-4 py-3 font-medium">Signals</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {flaggedClaims.map((claim) => {
                  const eventType = claim.live_disruption_events?.event_type as DisruptionType | undefined;
                  const triggerLabel = eventType ? TRIGGERS[eventType]?.label : 'Unknown';
                  const signals = Object.entries(claim.fraud_signals || {})
                    .filter(([, v]) => v)
                    .map(([k]) => k.replace(/_/g, ' '));
                  const isReviewing = reviewingId === claim.id;

                  return (
                    <tr key={claim.id} className="admin-row" style={{ borderTop: '1px solid var(--ink-10)', background: 'rgba(192,57,43,0.04)', transition: 'background 0.15s ease', cursor: 'pointer' }}>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--ink)' }}>
                        {claim.profiles?.full_name || 'Unknown'}
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--ink-60)' }}>
                        {triggerLabel}
                        <div className="text-xs" style={{ color: 'var(--ink-30)' }}>{claim.live_disruption_events?.city}</div>
                      </td>
                      <td className="px-4 py-3">
                        <FraudGauge score={claim.fraud_score} />
                      </td>
                      <td className="px-4 py-3 text-xs max-w-[180px] truncate" style={{ color: 'var(--ink-60)' }}>
                        {claim.flag_reason || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {signals.map((s) => (
                            <span
                              key={s}
                              className="mono text-xs px-1.5 py-0.5 rounded"
                              style={{ border: '1px solid var(--red-acc)', color: 'var(--red-acc)', transition: 'transform 0.15s ease', display: 'inline-block' }}
                              onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                              onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {(claim.status === 'pending_review' || claim.is_flagged) &&
                         claim.status !== 'approved' && claim.status !== 'rejected' && claim.status !== 'paid' && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleReview(claim.id, 'approve')}
                              disabled={isReviewing}
                              className="text-xs text-white px-3 py-1 rounded-lg disabled:opacity-50 transition-colors"
                              style={{ background: 'var(--teal)', transition: 'all 0.2s ease' }}
                              onMouseOver={e => { if (!isReviewing) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(13,148,136,0.3)'; } }}
                              onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                            >
                              {isReviewing ? '...' : 'Approve'}
                            </button>
                            <button
                              onClick={() => handleReview(claim.id, 'reject')}
                              disabled={isReviewing}
                              className="text-xs text-white px-3 py-1 rounded-lg disabled:opacity-50 transition-colors"
                              style={{ background: 'var(--red-acc)', transition: 'all 0.2s ease' }}
                              onMouseOver={e => { if (!isReviewing) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(192,57,43,0.3)'; } }}
                              onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                            >
                              {isReviewing ? '...' : 'Reject'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center" style={{ color: 'var(--ink-30)' }}>
            No flagged claims - all clear
          </div>
        )}
      </div>

      {/* --- Claims Table --- */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--cream)', border: '1px solid var(--rule)' }}>
        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" style={{ borderBottom: '1px solid var(--rule)' }}>
          <h2 className="serif text-lg font-bold" style={{ color: 'var(--ink)' }}>All Claims</h2>
          <div className="flex gap-2 flex-wrap">
            {['all', 'paid', 'pending_review', 'rejected', 'flagged'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className="mono text-xs px-3 py-1.5 rounded-full transition-colors"
                style={{
                  ...(filterStatus === status
                    ? { background: 'var(--teal)', color: '#fff', border: '1px solid var(--teal)' }
                    : { border: '1px solid var(--rule)', color: 'var(--ink-60)', background: 'transparent' }),
                  transition: 'all 0.2s ease',
                }}
                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                {status === 'all' ? 'All' : status === 'pending_review' ? 'Pending' : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ background: 'var(--cream-d)', color: 'var(--ink-60)' }}>
                <th className="px-4 py-3 font-medium">Claim ID</th>
                <th className="px-4 py-3 font-medium">Driver</th>
                <th className="px-4 py-3 font-medium">Event Type</th>
                <th className="px-4 py-3 font-medium">City</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Fraud Score</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredClaims.map((claim) => {
                const eventType = claim.live_disruption_events?.event_type as DisruptionType | undefined;
                const triggerLabel = eventType ? TRIGGERS[eventType]?.label : 'Unknown';
                const statusStyle = STATUS_STYLES[claim.status] || { border: '1px solid var(--ink-60)', color: 'var(--ink-60)' };
                const date = new Date(claim.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                });
                const shortId = `SS-CLM-${claim.id.slice(-4).toUpperCase()}`;

                return (
                  <tr
                    key={claim.id}
                    className="admin-row"
                    style={{
                      borderTop: '1px solid var(--ink-10)',
                      ...(claim.is_flagged ? { background: 'rgba(192,57,43,0.04)' } : {}),
                      transition: 'background 0.15s ease',
                      cursor: 'pointer',
                    }}
                  >
                    <td className="mono px-4 py-3 text-xs font-medium" style={{ color: 'var(--ink)' }}>{shortId}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--ink)' }}>
                      {claim.profiles?.full_name || 'Unknown'}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--ink-60)' }}>{triggerLabel}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--ink-60)' }}>
                      {claim.live_disruption_events?.city || claim.profiles?.city || '-'}
                    </td>
                    <td className="serif px-4 py-3 font-medium" style={{ color: 'var(--ink)' }}>
                      &#8377;{Number(claim.payout_amount_inr).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="mono text-xs font-medium px-2 py-1 rounded-full" style={{ ...statusStyle, transition: 'transform 0.15s ease', display: 'inline-block' }} onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.05)'; }} onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; }}>
                        {claim.status.replace(/_/g, ' ')}
                      </span>
                      {claim.is_flagged && (
                        <span
                          className="mono ml-1 text-xs font-medium px-2 py-1 rounded-full"
                          style={{ border: '1px solid var(--red-acc)', color: 'var(--red-acc)', transition: 'transform 0.15s ease', display: 'inline-block' }}
                          onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                          onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                        >
                          flagged
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <FraudGauge score={claim.fraud_score} />
                    </td>
                    <td className="mono px-4 py-3 text-xs" style={{ color: 'var(--ink-60)' }}>{date}</td>
                  </tr>
                );
              })}
              {filteredClaims.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center" style={{ color: 'var(--ink-30)' }}>
                    No claims found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
