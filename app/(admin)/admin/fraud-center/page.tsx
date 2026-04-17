'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CITIES } from '@/lib/config/cities';
import { DISRUPTION_TYPES, TRIGGERS, FRAUD } from '@/lib/config/constants';
import type { DisruptionType } from '@/lib/config/constants';
import { ShieldAlert, Zap, AlertTriangle, Users, Activity, Eye, RefreshCw, Clock, MapPin, Wifi, Fingerprint, BarChart3 } from 'lucide-react';

/* ═══════ Types ═══════ */

interface ClaimRow {
  id: string;
  profile_id: string;
  disruption_event_id: string;
  payout_amount_inr: number;
  status: string;
  fraud_score: number;
  is_flagged: boolean;
  flag_reason: string | null;
  fraud_signals: Record<string, boolean>;
  gate2_passed: boolean | null;
  activity_minutes: number | null;
  gps_within_zone: boolean | null;
  created_at: string;
  profiles: { full_name: string | null; city: string | null; trust_score: number } | null;
  live_disruption_events: { event_type: string; city: string; severity_score: number } | null;
}

interface ClusterRow {
  disruption_event_id: string;
  event_type: string | null;
  city: string | null;
  claim_count: number;
  window_seconds: number;
  unique_devices: number;
  flag_rate: number;
  first_claim_at: string;
  last_claim_at: string;
}

interface SimResult {
  status: string;
  event_id?: string;
  claims_created?: number;
  payouts_completed?: number;
  message?: string;
  error?: string;
}

/* ═══════ Palette ═══════ */

const F = "var(--font-inter),'Inter',sans-serif";
const M = "var(--font-ibm-plex-mono),'IBM Plex Mono',monospace";

const SIGNAL_CONFIG: Record<string, { label: string; icon: typeof AlertTriangle; color: string; weight: number }> = {
  duplicate:            { label: 'Duplicate Claim',    icon: AlertTriangle, color: '#EF4444', weight: FRAUD.WEIGHTS.duplicate },
  rapid_claims:         { label: 'Rapid Claims',       icon: Clock,         color: '#F59E0B', weight: FRAUD.WEIGHTS.rapid_claims },
  weather_mismatch:     { label: 'Weather Mismatch',   icon: Activity,      color: '#8B5CF6', weight: FRAUD.WEIGHTS.weather_mismatch },
  location_anomaly:     { label: 'Location Anomaly',   icon: MapPin,        color: '#EC4899', weight: FRAUD.WEIGHTS.location_anomaly },
  cluster:              { label: 'Cluster/Syndicate',   icon: Users,         color: '#3B82F6', weight: FRAUD.WEIGHTS.cluster },
  daily_limit_exceeded: { label: 'Daily Limit',        icon: BarChart3,     color: '#F97316', weight: 0 },
};

const ROW_GRADS = [
  'linear-gradient(90deg, rgba(99,102,241,0.05), rgba(139,92,246,0.02))',
  'linear-gradient(90deg, rgba(236,72,153,0.04), rgba(248,113,113,0.02))',
  'linear-gradient(90deg, rgba(59,130,246,0.04), rgba(6,182,212,0.02))',
  'linear-gradient(90deg, rgba(20,184,166,0.04), rgba(34,197,94,0.02))',
  'linear-gradient(90deg, rgba(249,115,22,0.04), rgba(250,204,21,0.02))',
];

/* ═══════ Page ═══════ */

export default function FraudCenterPage() {
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [clusters, setClusters] = useState<ClusterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'flagged' | 'simulator' | 'clusters'>('overview');

  // Simulator state
  const [simCity, setSimCity] = useState(CITIES[0].slug);
  const [simType, setSimType] = useState<DisruptionType>(DISRUPTION_TYPES[0]);
  const [simCount, setSimCount] = useState(1);
  const [simRunning, setSimRunning] = useState(false);
  const [simResults, setSimResults] = useState<SimResult[]>([]);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const [claimsRes, clustersRes] = await Promise.all([
      supabase.from('parametric_claims')
        .select('*, profiles(full_name, city, trust_score), live_disruption_events(event_type, city, severity_score)')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('fraud_cluster_signals')
        .select('*')
        .order('claim_count', { ascending: false })
        .limit(20),
    ]);
    setClaims((claimsRes.data as unknown as ClaimRow[]) || []);
    setClusters((clustersRes.data as unknown as ClusterRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  /* Computed */
  const totalClaims = claims.length;
  const flaggedClaims = useMemo(() => claims.filter(c => c.is_flagged), [claims]);
  const pendingReview = useMemo(() => claims.filter(c => c.status === 'pending_review'), [claims]);
  const rejectedClaims = useMemo(() => claims.filter(c => c.status === 'rejected'), [claims]);
  const avgFraudScore = useMemo(() => claims.length > 0 ? claims.reduce((s, c) => s + c.fraud_score, 0) / claims.length : 0, [claims]);

  // Signal distribution
  const signalCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of claims) {
      if (!c.fraud_signals) continue;
      for (const [key, val] of Object.entries(c.fraud_signals)) {
        if (val) counts[key] = (counts[key] || 0) + 1;
      }
    }
    return counts;
  }, [claims]);

  // Gate 2 stats
  const gate2Stats = useMemo(() => {
    let passed = 0, failed = 0, pending = 0;
    for (const c of claims) {
      if (c.gate2_passed === true) passed++;
      else if (c.gate2_passed === false) failed++;
      else pending++;
    }
    return { passed, failed, pending };
  }, [claims]);

  /* Simulator */
  async function runSimulation() {
    setSimRunning(true);
    setSimResults([]);
    const results: SimResult[] = [];
    for (let i = 0; i < simCount; i++) {
      try {
        const res = await fetch('/api/admin/demo-trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ city: simCity, event_type: simType, severity: 7 + Math.random() * 3 }),
        });
        const data = await res.json() as SimResult;
        results.push(data);
      } catch (err) {
        results.push({ status: 'error', error: err instanceof Error ? err.message : 'Failed' });
      }
    }
    setSimResults(results);
    setSimRunning(false);
    // Reload data to see new claims
    await loadData();
  }

  /* Review handler */
  async function handleReview(claimId: string, action: 'approve' | 'reject') {
    try {
      await fetch('/api/admin/review-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim_id: claimId, action }),
      });
      await loadData();
    } catch { /* best effort */ }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-10 h-10 rounded-full animate-spin" style={{ border: '3px solid #F3F4F6', borderTopColor: '#EF4444' }} />
    </div>
  );

  return (
    <div className="space-y-6">
      <style>{`
        @keyframes fSlide { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .f-s { animation: fSlide 0.4s ease both; }
        .f-s1{animation-delay:.05s} .f-s2{animation-delay:.1s} .f-s3{animation-delay:.15s} .f-s4{animation-delay:.2s}
      `}</style>

      <div className="flex items-center justify-between">
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1A1A1A', letterSpacing: '-0.03em', fontFamily: F }}>Fraud Center</h1>
        <button onClick={() => { setLoading(true); loadData(); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid #E8E8EA', background: '#fff', color: '#6B7280', cursor: 'pointer', fontFamily: M }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* KPI cards */}
      <div className="f-s f-s1 grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Claims', value: totalClaims, gradient: 'linear-gradient(135deg, #6366F1, #8B5CF6)', icon: BarChart3 },
          { label: 'Flagged', value: flaggedClaims.length, gradient: 'linear-gradient(135deg, #F97316, #FACC15)', icon: AlertTriangle },
          { label: 'Fraud Rejected', value: rejectedClaims.length, gradient: 'linear-gradient(135deg, #EF4444, #DC2626)', icon: ShieldAlert },
          { label: 'Legacy Pending', value: pendingReview.length, gradient: 'linear-gradient(135deg, #6B7280, #9CA3AF)', icon: Eye },
          { label: 'Avg Fraud Score', value: (avgFraudScore * 100).toFixed(0) + '%', gradient: 'linear-gradient(135deg, #14B8A6, #22C55E)', icon: Activity },
        ].map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-2xl p-4 relative overflow-hidden" style={{ background: k.gradient, color: '#fff', borderRadius: 16, transition: 'all 0.2s' }}
              onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 28px rgba(99,102,241,0.2)'; }}
              onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ position: 'absolute', top: -8, right: -8, width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
              <Icon size={16} style={{ opacity: 0.8, marginBottom: 4 }} />
              <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.8, fontFamily: M }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2, fontFamily: F }}>{k.value}</div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="f-s f-s2 flex gap-2">
        {[
          { id: 'overview' as const, label: 'Fraud Signals', icon: Activity },
          { id: 'flagged' as const, label: `Flagged & Rejected (${flaggedClaims.length + rejectedClaims.length})`, icon: AlertTriangle },
          { id: 'clusters' as const, label: `Cluster Signals (${clusters.length})`, icon: Users },
          { id: 'simulator' as const, label: 'Fraud Simulator', icon: Zap },
        ].map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '8px 16px', borderRadius: 12, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', gap: 6, fontFamily: M,
              background: tab === t.id ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : '#fff',
              color: tab === t.id ? '#fff' : '#6B7280',
              border: tab === t.id ? 'none' : '1px solid #E8E8EA',
            }}>
              <Icon size={13} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ═══════ Tab: Fraud Signals Overview ═══════ */}
      {tab === 'overview' && (
        <div className="f-s f-s3 space-y-4">
          {/* Signal distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid #E8E8EA', borderRadius: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', fontFamily: F, marginBottom: 12 }}>Signal Distribution</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(SIGNAL_CONFIG).map(([key, cfg]) => {
                  const count = signalCounts[key] || 0;
                  const pct = totalClaims > 0 ? (count / totalClaims) * 100 : 0;
                  const Icon = cfg.icon;
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Icon size={14} style={{ color: cfg.color }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A', fontFamily: F }}>{cfg.label}</span>
                          {cfg.weight > 0 && <span style={{ fontSize: 9, color: '#9CA3AF', fontFamily: M }}>weight: {(cfg.weight * 100).toFixed(0)}%</span>}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color, fontFamily: M }}>{count}</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: '#F3F4F6', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 3, background: cfg.color, width: `${Math.max(pct, 1)}%`, transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Gate 2 verification stats */}
            <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid #E8E8EA', borderRadius: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', fontFamily: F, marginBottom: 12 }}>Gate 2 Verification</h3>
              <div className="flex items-center gap-4 mb-4">
                {[
                  { label: 'Passed', value: gate2Stats.passed, color: '#22C55E' },
                  { label: 'Failed', value: gate2Stats.failed, color: '#EF4444' },
                  { label: 'Pending', value: gate2Stats.pending, color: '#F59E0B' },
                ].map(s => (
                  <div key={s.label} style={{ flex: 1, textAlign: 'center', padding: '12px 0', borderRadius: 12, background: `${s.color}10`, border: `1px solid ${s.color}20` }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: F }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: '#6B7280', fontFamily: M, marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', fontFamily: F, marginBottom: 12, marginTop: 16 }}>Fraud Routing</h3>
              <div className="flex items-center gap-4">
                {[
                  { label: 'Auto-Approved', value: claims.filter(c => c.fraud_score < FRAUD.AUTO_APPROVE_THRESHOLD && c.status !== 'rejected').length, color: '#22C55E' },
                  { label: 'Flagged (Paid)', value: claims.filter(c => c.fraud_score >= FRAUD.AUTO_APPROVE_THRESHOLD && c.fraud_score < FRAUD.MANUAL_REVIEW_THRESHOLD && c.status !== 'rejected').length, color: '#F59E0B' },
                  { label: 'Auto-Rejected', value: claims.filter(c => c.fraud_score >= FRAUD.MANUAL_REVIEW_THRESHOLD || c.status === 'rejected').length, color: '#EF4444' },
                ].map(s => (
                  <div key={s.label} style={{ flex: 1, textAlign: 'center', padding: '12px 0', borderRadius: 12, background: `${s.color}10`, border: `1px solid ${s.color}20` }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: F }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: '#6B7280', fontFamily: M, marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Thresholds reference */}
              <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: '#F9FAFB', border: '1px solid #F3F4F6' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', fontFamily: M, marginBottom: 6 }}>FRAUD SCORE THRESHOLDS</div>
                <div className="flex gap-2">
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: 'rgba(34,197,94,0.1)', color: '#22C55E', fontFamily: M }}>&lt;{(FRAUD.AUTO_APPROVE_THRESHOLD * 100).toFixed(0)}% Auto-Approve + Pay</span>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: 'rgba(245,158,11,0.1)', color: '#F59E0B', fontFamily: M }}>{(FRAUD.AUTO_APPROVE_THRESHOLD * 100).toFixed(0)}%-{(FRAUD.MANUAL_REVIEW_THRESHOLD * 100).toFixed(0)}% Approve + Flag</span>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#EF4444', fontFamily: M }}>&ge;{(FRAUD.MANUAL_REVIEW_THRESHOLD * 100).toFixed(0)}% Auto-Reject</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Tab: Flagged Claims ═══════ */}
      {tab === 'flagged' && (
        <div className="f-s f-s3 rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E8E8EA', borderRadius: 16 }}>
          <div className="px-5 py-3" style={{ borderBottom: '1px solid #E8E8EA' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', fontFamily: F }}>Flagged & Auto-Rejected Claims</h3>
          </div>
          <div className="overflow-x-auto" style={{ maxHeight: 500, overflowY: 'auto' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'linear-gradient(90deg, rgba(239,68,68,0.06), rgba(236,72,153,0.03))' }}>
                  {['Driver', 'City', 'Event', 'Fraud Score', 'Signals', 'Gate 2', 'Trust', 'Reason', 'Actions'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium text-xs uppercase tracking-wide" style={{ color: '#6B7280', fontFamily: M }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...rejectedClaims, ...flaggedClaims.filter(c => c.status !== 'rejected')].map((claim, idx) => {
                  const scoreColor = claim.fraud_score >= 0.7 ? '#EF4444' : claim.fraud_score >= 0.3 ? '#F59E0B' : '#22C55E';
                  const activeSignals = Object.entries(claim.fraud_signals || {}).filter(([, v]) => v).map(([k]) => k);
                  return (
                    <tr key={claim.id} style={{ borderTop: '1px solid #F3F4F6', background: ROW_GRADS[idx % ROW_GRADS.length], transition: 'all 0.15s' }}>
                      <td className="px-3 py-2.5 font-medium" style={{ color: '#1A1A1A', fontSize: 12 }}>{claim.profiles?.full_name || 'Unknown'}</td>
                      <td className="px-3 py-2.5" style={{ color: '#6B7280', fontSize: 12 }}>{claim.profiles?.city || '-'}</td>
                      <td className="px-3 py-2.5">
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(139,92,246,0.08)', color: '#8B5CF6', fontFamily: M }}>
                          {TRIGGERS[claim.live_disruption_events?.event_type as DisruptionType]?.label || claim.live_disruption_events?.event_type || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div style={{ width: 32, height: 5, borderRadius: 3, background: '#F3F4F6', overflow: 'hidden' }}>
                            <div style={{ width: `${claim.fraud_score * 100}%`, height: '100%', borderRadius: 3, background: scoreColor }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor, fontFamily: M }}>{(claim.fraud_score * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {activeSignals.map(s => {
                            const cfg = SIGNAL_CONFIG[s];
                            return cfg ? (
                              <span key={s} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: `${cfg.color}15`, color: cfg.color, fontFamily: M, fontWeight: 600 }}>{cfg.label}</span>
                            ) : null;
                          })}
                          {activeSignals.length === 0 && <span style={{ fontSize: 10, color: '#D1D5DB' }}>none</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 8, fontFamily: M, background: claim.gate2_passed ? 'rgba(34,197,94,0.1)' : claim.gate2_passed === false ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', color: claim.gate2_passed ? '#22C55E' : claim.gate2_passed === false ? '#EF4444' : '#F59E0B' }}>
                          {claim.gate2_passed ? 'Pass' : claim.gate2_passed === false ? 'Fail' : 'Pending'}
                        </span>
                        {claim.activity_minutes != null && <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 2, fontFamily: M }}>{claim.activity_minutes}min | GPS: {claim.gps_within_zone ? 'Yes' : 'No'}</div>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span style={{ fontSize: 11, fontWeight: 700, color: (claim.profiles?.trust_score ?? 0.5) < 0.3 ? '#EF4444' : (claim.profiles?.trust_score ?? 0.5) < 0.5 ? '#F59E0B' : '#22C55E', fontFamily: M }}>
                          {((claim.profiles?.trust_score ?? 0.5) * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-3 py-2.5" style={{ maxWidth: 180 }}>
                        <span style={{ fontSize: 10, color: '#6B7280', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{claim.flag_reason || '-'}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 10, fontFamily: M, display: 'inline-block',
                          background: claim.status === 'rejected' ? 'linear-gradient(135deg, #EF4444, #DC2626)' : claim.status === 'paid' ? 'linear-gradient(135deg, #22C55E, #16A34A)' : claim.status === 'approved' ? 'rgba(34,197,94,0.1)' : 'rgba(107,114,128,0.1)',
                          color: claim.status === 'rejected' || claim.status === 'paid' ? '#fff' : claim.status === 'approved' ? '#22C55E' : '#6B7280',
                        }}>{claim.status}</span>
                      </td>
                    </tr>
                  );
                })}
                {pendingReview.length === 0 && flaggedClaims.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-12 text-center" style={{ color: '#9CA3AF' }}>No flagged or pending claims</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════ Tab: Cluster Signals ═══════ */}
      {tab === 'clusters' && (
        <div className="f-s f-s3 rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E8E8EA', borderRadius: 16 }}>
          <div className="px-5 py-3" style={{ borderBottom: '1px solid #E8E8EA' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', fontFamily: F }}>Syndicate / Cluster Detection</h3>
            <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>Flags when {FRAUD.CLUSTER_THRESHOLD}+ claims fire on the same event within {FRAUD.CLUSTER_WINDOW_MINUTES} minutes with shared devices/IPs</p>
          </div>
          {clusters.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'linear-gradient(90deg, rgba(59,130,246,0.06), rgba(6,182,212,0.03))' }}>
                    {['Event Type', 'City', 'Claims', 'Window', 'Unique Devices', 'Flag Rate', 'First Claim', 'Last Claim'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left font-medium text-xs uppercase tracking-wide" style={{ color: '#6B7280', fontFamily: M }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clusters.map((c, idx) => (
                    <tr key={c.disruption_event_id} style={{ borderTop: '1px solid #F3F4F6', background: ROW_GRADS[idx % ROW_GRADS.length] }}>
                      <td className="px-4 py-2.5" style={{ color: '#1A1A1A', fontSize: 12, fontWeight: 500 }}>{TRIGGERS[c.event_type as DisruptionType]?.label || c.event_type || '-'}</td>
                      <td className="px-4 py-2.5" style={{ color: '#6B7280', fontSize: 12 }}>{c.city || '-'}</td>
                      <td className="px-4 py-2.5" style={{ fontSize: 14, fontWeight: 800, color: c.claim_count >= FRAUD.CLUSTER_THRESHOLD ? '#EF4444' : '#1A1A1A', fontFamily: M }}>{c.claim_count}</td>
                      <td className="px-4 py-2.5 mono" style={{ fontSize: 11, color: '#6B7280' }}>{Math.round(c.window_seconds / 60)}min</td>
                      <td className="px-4 py-2.5 mono" style={{ fontSize: 11, color: '#6B7280' }}>{c.unique_devices}</td>
                      <td className="px-4 py-2.5">
                        <span style={{ fontSize: 11, fontWeight: 700, color: c.flag_rate > 0.5 ? '#EF4444' : '#F59E0B', fontFamily: M }}>{(c.flag_rate * 100).toFixed(0)}%</span>
                      </td>
                      <td className="px-4 py-2.5 mono" style={{ fontSize: 10, color: '#9CA3AF' }}>{new Date(c.first_claim_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="px-4 py-2.5 mono" style={{ fontSize: 10, color: '#9CA3AF' }}>{new Date(c.last_claim_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center" style={{ color: '#9CA3AF' }}>No cluster signals detected yet. Fire multiple rapid triggers to test.</div>
          )}
        </div>
      )}

      {/* ═══════ Tab: Fraud Simulator ═══════ */}
      {tab === 'simulator' && (
        <div className="f-s f-s3 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Simulator controls */}
            <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid #E8E8EA', borderRadius: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', fontFamily: F, marginBottom: 12 }}>Fire Test Triggers</h3>
              <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>Rapidly fire multiple triggers to test fraud detection thresholds.</p>
              <div className="space-y-3">
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#1A1A1A', fontFamily: M, display: 'block', marginBottom: 4 }}>City</label>
                  <select value={simCity} onChange={e => setSimCity(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid #E8E8EA' }}>
                    {CITIES.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#1A1A1A', fontFamily: M, display: 'block', marginBottom: 4 }}>Disruption Type</label>
                  <select value={simType} onChange={e => setSimType(e.target.value as DisruptionType)} className="w-full rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid #E8E8EA' }}>
                    {DISRUPTION_TYPES.map(dt => <option key={dt} value={dt}>{TRIGGERS[dt].label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#1A1A1A', fontFamily: M, display: 'block', marginBottom: 4 }}>
                    Number of triggers: <span style={{ color: '#8B5CF6', fontWeight: 800 }}>{simCount}</span>
                  </label>
                  <input type="range" min={1} max={10} value={simCount} onChange={e => setSimCount(Number(e.target.value))} className="w-full" style={{ accentColor: '#8B5CF6' }} />
                  <div className="flex justify-between" style={{ fontSize: 9, color: '#9CA3AF' }}><span>1 (safe)</span><span>3 (rapid flag)</span><span>10 (cluster)</span></div>
                </div>
                <button onClick={runSimulation} disabled={simRunning} style={{
                  width: '100%', padding: '10px 0', borderRadius: 12, fontSize: 13, fontWeight: 700, border: 'none', cursor: simRunning ? 'not-allowed' : 'pointer',
                  background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: simRunning ? 0.6 : 1, transition: 'all 0.2s',
                }}>
                  <Zap size={15} /> {simRunning ? `Firing ${simCount} triggers...` : `Fire ${simCount} Trigger${simCount > 1 ? 's' : ''}`}
                </button>
              </div>
            </div>

            {/* What to expect */}
            <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid #E8E8EA', borderRadius: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', fontFamily: F, marginBottom: 12 }}>What Gets Tested</h3>
              <div className="space-y-3">
                {[
                  { triggers: '1', test: 'Clean claim — should auto-approve if driver is in zone', color: '#22C55E' },
                  { triggers: '3+', test: 'Rapid claims flag — 3+ in 24h triggers fraud signal (+20% score)', color: '#F59E0B' },
                  { triggers: '5+', test: 'Daily limit — exceeds max claims per day', color: '#F97316' },
                  { triggers: '10+', test: 'Cluster detection — syndicate pattern analysis kicks in (+10% score)', color: '#EF4444' },
                ].map(item => (
                  <div key={item.triggers} className="flex items-start gap-3" style={{ padding: '8px 10px', borderRadius: 10, background: `${item.color}08`, border: `1px solid ${item.color}15` }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: item.color, fontFamily: M, minWidth: 30, flexShrink: 0 }}>{item.triggers}</span>
                    <span style={{ fontSize: 12, color: '#4B5563' }}>{item.test}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: '#F9FAFB', border: '1px solid #F3F4F6' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', fontFamily: M, marginBottom: 4 }}>ALSO CHECKED PER CLAIM</div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { icon: MapPin, label: 'GPS vs IP integrity' },
                    { icon: Wifi, label: 'Impossible travel' },
                    { icon: Fingerprint, label: 'Device fingerprint' },
                    { icon: Activity, label: 'Weather data match' },
                    { icon: ShieldAlert, label: 'Trust score penalty' },
                  ].map(c => {
                    const Icon = c.icon;
                    return (
                      <span key={c.label} className="flex items-center gap-1" style={{ fontSize: 10, padding: '3px 8px', borderRadius: 8, background: 'rgba(99,102,241,0.06)', color: '#6366F1', fontFamily: M }}>
                        <Icon size={10} /> {c.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Simulation results */}
          {simResults.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E8E8EA', borderRadius: 16 }}>
              <div className="px-5 py-3" style={{ borderBottom: '1px solid #E8E8EA' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', fontFamily: F }}>Simulation Results</h3>
              </div>
              <div className="p-4 space-y-2">
                {simResults.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: r.error ? 'rgba(239,68,68,0.06)' : 'rgba(34,197,94,0.06)', border: `1px solid ${r.error ? '#F8717120' : '#22C55E20'}` }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: r.error ? '#EF4444' : '#22C55E', fontFamily: M, minWidth: 20 }}>#{i + 1}</span>
                    <span style={{ fontSize: 12, color: '#4B5563', flex: 1 }}>{r.error || r.message}</span>
                    {r.claims_created != null && (
                      <div className="flex gap-2">
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: 'rgba(99,102,241,0.08)', color: '#6366F1', fontFamily: M }}>{r.claims_created} claims</span>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: r.payouts_completed ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', color: r.payouts_completed ? '#22C55E' : '#EF4444', fontFamily: M }}>{r.payouts_completed ?? 0} paid</span>
                      </div>
                    )}
                  </div>
                ))}
                {/* Summary */}
                <div style={{ marginTop: 8, padding: 12, borderRadius: 10, background: '#F9FAFB', border: '1px solid #F3F4F6' }}>
                  <div style={{ fontSize: 11, color: '#6B7280', fontFamily: M }}>
                    Total: {simResults.filter(r => !r.error).length} triggers fired &middot;{' '}
                    {simResults.reduce((s, r) => s + (r.claims_created || 0), 0)} claims created &middot;{' '}
                    {simResults.reduce((s, r) => s + (r.payouts_completed || 0), 0)} payouts completed
                  </div>
                  {simResults.reduce((s, r) => s + (r.claims_created || 0), 0) === 0 && (
                    <div style={{ fontSize: 11, color: '#F59E0B', fontFamily: M, marginTop: 4 }}>
                      No claims created — this usually means there are no active paid policies for {simCity} this week.
                      Go to Policy Center to check, or create test policies via the onboarding flow.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Recent claims from this city — live view */}
          {simResults.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E8E8EA', borderRadius: 16 }}>
              <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #E8E8EA' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', fontFamily: F }}>Recent Claims — {simCity}</h3>
                <button onClick={loadData} style={{ fontSize: 10, padding: '3px 10px', borderRadius: 8, background: '#F3F4F6', color: '#6B7280', border: 'none', cursor: 'pointer', fontFamily: M }}>Refresh</button>
              </div>
              {(() => {
                const cityClaims = claims.filter(c => (c.profiles?.city || c.live_disruption_events?.city) === simCity).slice(0, 10);
                if (cityClaims.length === 0) return <div className="p-8 text-center" style={{ color: '#9CA3AF', fontSize: 12 }}>No claims found for {simCity}. Check if active policies exist.</div>;
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: 'linear-gradient(90deg, rgba(99,102,241,0.05), rgba(139,92,246,0.02))' }}>
                          {['Driver', 'Status', 'Fraud Score', 'Signals', 'Gate 2', 'Payout', 'Time'].map(h => (
                            <th key={h} className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wide" style={{ color: '#6B7280', fontFamily: M }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {cityClaims.map((c, idx) => {
                          const scoreColor = c.fraud_score >= 0.7 ? '#EF4444' : c.fraud_score >= 0.3 ? '#F59E0B' : '#22C55E';
                          const statusGrad = c.status === 'paid' ? 'linear-gradient(135deg, #22C55E, #16A34A)' : c.status === 'rejected' ? 'linear-gradient(135deg, #EF4444, #DC2626)' : c.status === 'approved' ? 'linear-gradient(135deg, #3B82F6, #06B6D4)' : 'linear-gradient(135deg, #6B7280, #9CA3AF)';
                          const signals = Object.entries(c.fraud_signals || {}).filter(([, v]) => v).map(([k]) => k);
                          return (
                            <tr key={c.id} style={{ borderTop: '1px solid #F3F4F6', background: ROW_GRADS[idx % ROW_GRADS.length] }}>
                              <td className="px-3 py-2 font-medium" style={{ fontSize: 12, color: '#1A1A1A' }}>{c.profiles?.full_name || 'Unknown'}</td>
                              <td className="px-3 py-2"><span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 8, background: statusGrad, color: '#fff', fontFamily: M }}>{c.status}</span></td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <div style={{ width: 28, height: 4, borderRadius: 2, background: '#F3F4F6', overflow: 'hidden' }}><div style={{ width: `${c.fraud_score * 100}%`, height: '100%', borderRadius: 2, background: scoreColor }} /></div>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: scoreColor, fontFamily: M }}>{(c.fraud_score * 100).toFixed(0)}%</span>
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex flex-wrap gap-1">
                                  {signals.length > 0 ? signals.map(s => <span key={s} style={{ fontSize: 8, padding: '1px 5px', borderRadius: 6, background: `${SIGNAL_CONFIG[s]?.color || '#6B7280'}15`, color: SIGNAL_CONFIG[s]?.color || '#6B7280', fontFamily: M }}>{s.replace(/_/g, ' ')}</span>) : <span style={{ fontSize: 9, color: '#D1D5DB' }}>clean</span>}
                                </div>
                              </td>
                              <td className="px-3 py-2"><span style={{ fontSize: 10, color: c.gate2_passed ? '#22C55E' : c.gate2_passed === false ? '#EF4444' : '#9CA3AF', fontWeight: 600, fontFamily: M }}>{c.gate2_passed ? 'Pass' : c.gate2_passed === false ? 'Fail' : '-'}</span></td>
                              <td className="px-3 py-2" style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1A', fontFamily: M }}>{'\u20B9'}{Number(c.payout_amount_inr).toLocaleString()}</td>
                              <td className="px-3 py-2 mono" style={{ fontSize: 9, color: '#9CA3AF' }}>{new Date(c.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
