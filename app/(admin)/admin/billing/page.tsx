'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

/* ---------- Types ---------- */

interface PolicyRow {
  id: string;
  profile_id: string;
  week_start_date: string;
  final_premium_inr: number;
  payment_status: string;
  total_payout_this_week: number;
  created_at: string;
}

interface ClaimRow {
  id: string;
  payout_amount_inr: number;
  status: string;
  created_at: string;
  live_disruption_events: { city: string } | null;
}

interface PayoutRow {
  id: string;
  amount_inr: number;
  status: string;
  completed_at: string | null;
  created_at: string;
}

/* ---------- Skeleton ---------- */

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded ${className}`}
      style={{ background: 'var(--ink-10)' }}
    />
  );
}

/* ---------- Helpers ---------- */

function formatINR(n: number): string {
  if (n >= 100000) return `\u20B9${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `\u20B9${(n / 1000).toFixed(1)}k`;
  return `\u20B9${n.toLocaleString()}`;
}

function trendArrow(current: number, previous: number): { arrow: string; pct: string; up: boolean } {
  if (previous === 0) return { arrow: '-', pct: '0%', up: true };
  const change = ((current - previous) / previous) * 100;
  return {
    arrow: change >= 0 ? '\u2191' : '\u2193',
    pct: `${Math.abs(change).toFixed(1)}%`,
    up: change >= 0,
  };
}

/* ---------- Page ---------- */

export default function AdminBillingPage() {
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const [policiesRes, claimsRes, payoutsRes] = await Promise.all([
          supabase.from('weekly_policies').select('*').order('created_at', { ascending: false }),
          supabase.from('parametric_claims').select('*, live_disruption_events(city)').order('created_at', { ascending: false }),
          supabase.from('payout_ledger').select('*').order('created_at', { ascending: false }),
        ]);

        if (policiesRes.error) throw policiesRes.error;
        if (claimsRes.error) throw claimsRes.error;
        if (payoutsRes.error) throw payoutsRes.error;

        setPolicies((policiesRes.data as unknown as PolicyRow[]) || []);
        setClaims((claimsRes.data as unknown as ClaimRow[]) || []);
        setPayouts((payoutsRes.data as unknown as PayoutRow[]) || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load billing data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  /* --- KPI Calculations --- */

  const totalPremiums = useMemo(() => {
    return policies
      .filter((p) => p.payment_status === 'paid' || p.payment_status === 'demo')
      .reduce((sum, p) => sum + Number(p.final_premium_inr), 0);
  }, [policies]);

  const totalPayouts = useMemo(() => {
    return claims
      .filter((c) => c.status === 'paid' || c.status === 'approved')
      .reduce((sum, c) => sum + Number(c.payout_amount_inr), 0);
  }, [claims]);

  const lossRatio = totalPremiums > 0 ? totalPayouts / totalPremiums : 0;

  const totalClaimsAmount = useMemo(() => {
    return claims.reduce((sum, c) => sum + Number(c.payout_amount_inr), 0);
  }, [claims]);

  const bcr = totalPremiums > 0 ? totalClaimsAmount / totalPremiums : 0;

  const failedPayments = useMemo(() => {
    return policies.filter((p) => p.payment_status === 'failed').length;
  }, [policies]);

  /* --- Weekly data for trends --- */

  const weeklyData = useMemo(() => {
    // Group policies by week
    const weekPremiums: Record<string, number> = {};
    for (const p of policies) {
      if (p.payment_status === 'paid' || p.payment_status === 'demo') {
        const week = p.week_start_date;
        weekPremiums[week] = (weekPremiums[week] || 0) + Number(p.final_premium_inr);
      }
    }

    // Group claims by week
    const weekPayouts: Record<string, number> = {};
    for (const c of claims) {
      if (c.status === 'paid' || c.status === 'approved') {
        const d = new Date(c.created_at);
        const dayOfWeek = d.getDay();
        const mondayDate = new Date(d);
        mondayDate.setDate(d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
        const week = mondayDate.toISOString().split('T')[0];
        weekPayouts[week] = (weekPayouts[week] || 0) + Number(c.payout_amount_inr);
      }
    }

    // Combine
    const allWeeks = [...new Set([...Object.keys(weekPremiums), ...Object.keys(weekPayouts)])].sort();
    const last8 = allWeeks.slice(-8);

    return last8.map((week) => ({
      week,
      premiums: weekPremiums[week] || 0,
      payouts: weekPayouts[week] || 0,
      lossRatio: (weekPremiums[week] || 0) > 0
        ? (weekPayouts[week] || 0) / (weekPremiums[week] || 1)
        : 0,
    }));
  }, [policies, claims]);

  /* --- Monthly payouts --- */

  const monthlyPayouts = useMemo(() => {
    const months: Record<string, number> = {};
    for (const p of payouts) {
      if (p.status === 'completed' || p.status === 'success') {
        const d = new Date(p.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
        months[key] = (months[key] || 0) + Number(p.amount_inr);
      }
    }
    // Also count from claims if payout_ledger is empty
    if (Object.keys(months).length === 0) {
      for (const c of claims) {
        if (c.status === 'paid' || c.status === 'approved') {
          const d = new Date(c.created_at);
          const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
          months[key] = (months[key] || 0) + Number(c.payout_amount_inr);
        }
      }
    }
    return Object.entries(months).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
  }, [payouts, claims]);

  const monthlyMax = monthlyPayouts.length > 0 ? Math.max(...monthlyPayouts.map((m) => m[1])) : 1;

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* --- Zone-wise payout breakdown --- */

  const zonePayouts = useMemo(() => {
    const zones: Record<string, number> = {};
    for (const c of claims) {
      if (c.status === 'paid' || c.status === 'approved') {
        const city = c.live_disruption_events?.city || 'Unknown';
        zones[city] = (zones[city] || 0) + Number(c.payout_amount_inr);
      }
    }
    const total = Object.values(zones).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(zones)
      .sort((a, b) => b[1] - a[1])
      .map(([city, amount]) => ({ city, amount, pct: (amount / total) * 100 }));
  }, [claims]);

  const zoneMax = zonePayouts.length > 0 ? zonePayouts[0].amount : 1;

  /* --- Premium vs Payout weekly --- */

  const weeklyMaxVal = useMemo(() => {
    if (weeklyData.length === 0) return 1;
    return Math.max(...weeklyData.map((w) => Math.max(w.premiums, w.payouts)), 1);
  }, [weeklyData]);

  /* --- Failed policies list --- */
  const failedPolicies = useMemo(() => {
    return policies.filter((p) => p.payment_status === 'failed');
  }, [policies]);

  /* --- Trend calculations (compare last 2 weeks) --- */
  const trends = useMemo(() => {
    if (weeklyData.length < 2) {
      return { premiums: { arrow: '-', pct: '0%', up: true }, payouts: { arrow: '-', pct: '0%', up: true }, lr: { arrow: '-', pct: '0%', up: true } };
    }
    const curr = weeklyData[weeklyData.length - 1];
    const prev = weeklyData[weeklyData.length - 2];
    return {
      premiums: trendArrow(curr.premiums, prev.premiums),
      payouts: trendArrow(curr.payouts, prev.payouts),
      lr: trendArrow(curr.lossRatio, prev.lossRatio),
    };
  }, [weeklyData]);

  /* --- Revenue Donut data --- */
  const netRevenue = totalPremiums - totalPayouts;
  const donutData = useMemo(() => {
    const total = totalPremiums || 1;
    const payoutPct = (totalPayouts / total) * 100;
    const netPct = Math.max(((totalPremiums - totalPayouts) / total) * 100, 0);
    const failedAmt = policies.filter(p => p.payment_status === 'failed').reduce((s, p) => s + Number(p.final_premium_inr), 0);
    const failedPct = (failedAmt / total) * 100;
    return { payoutPct, netPct, failedPct, failedAmt };
  }, [totalPremiums, totalPayouts, policies]);

  /* --- Loading / Error --- */

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="serif text-2xl font-bold">Billing Center</h1>
        <div className="rounded-2xl p-5" style={{ background: 'rgba(192,57,43,0.06)', border: '1px solid var(--red-acc)' }}>
          <p className="font-medium" style={{ color: 'var(--red-acc)' }}>Failed to load data</p>
          <p className="text-sm mt-1" style={{ color: 'var(--red-acc)' }}>{error}</p>
        </div>
      </div>
    );
  }

  /* --- BCR Gauge helpers --- */

  const bcrClamped = Math.min(bcr, 1.0);
  const bcrAngle = bcrClamped / 1.0 * 180;
  const bcrColor = bcr <= 0.70 ? '#0d9488' : bcr <= 0.85 ? '#f59e0b' : '#ef4444';
  const bcrStatus = bcr <= 0.55 ? 'Healthy' : bcr <= 0.70 ? 'Healthy' : bcr <= 0.85 ? 'Watch' : 'Critical';

  /* --- Loss Ratio accent --- */
  const lrColor = lossRatio <= 0.70 ? '#0d9488' : lossRatio <= 0.85 ? '#f59e0b' : '#ef4444';

  /* --- Card style helper --- */
  const card: React.CSSProperties = {
    background: 'var(--cream)',
    border: '1px solid var(--rule)',
    borderRadius: 16,
  };

  return (
    <div className="space-y-6">
      <style>{`
        @keyframes growBar {
          from { transform: scaleY(0); }
          to { transform: scaleY(1); }
        }
        @keyframes growBarX {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .bar-grow {
          animation: growBar 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
          transform-origin: bottom;
        }
        .bar-grow-x {
          animation: growBarX 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
          transform-origin: left;
        }
        .fade-up {
          animation: fadeUp 0.5s ease-out forwards;
        }
        .kpi-card {
          transition: transform 0.2s ease;
        }
        .kpi-card:hover {
          transform: translateY(-2px);
        }
      `}</style>

      {/* ====== Page Header ====== */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="serif text-3xl font-bold" style={{ color: 'var(--ink)' }}>Billing Analytics</h1>
          <p className="mono text-xs mt-1" style={{ color: 'var(--ink-30)' }}>
            Financial performance overview &middot; {policies.length} policies &middot; {claims.length} claims
          </p>
        </div>
        <div className="mono text-xs px-3 py-1.5 rounded-full" style={{ background: 'var(--ink-10)', color: 'var(--ink-60)' }}>
          Last updated: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      </div>

      {/* ====== Section 1: KPI Summary Row ====== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Premiums Collected */}
        <div className="kpi-card p-5" style={{ ...card, borderLeft: '3px solid #8b5cf6' }}>
          <p className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--ink-30)' }}>
            Premiums Collected
          </p>
          <p className="serif text-[26px] font-bold mt-2 leading-none" style={{ color: 'var(--ink)' }}>
            {formatINR(totalPremiums)}
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <span
              className="mono text-xs font-semibold"
              style={{ color: trends.premiums.up ? '#0d9488' : '#ef4444' }}
            >
              {trends.premiums.arrow} {trends.premiums.pct}
            </span>
            <span className="mono text-[10px]" style={{ color: 'var(--ink-30)' }}>vs last week</span>
          </div>
        </div>

        {/* Total Payouts */}
        <div className="kpi-card p-5" style={{ ...card, borderLeft: '3px solid #0d9488' }}>
          <p className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--ink-30)' }}>
            Total Payouts
          </p>
          <p className="serif text-[26px] font-bold mt-2 leading-none" style={{ color: '#0d9488' }}>
            {formatINR(totalPayouts)}
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <span
              className="mono text-xs font-semibold"
              style={{ color: trends.payouts.up ? '#ef4444' : '#0d9488' }}
            >
              {trends.payouts.arrow} {trends.payouts.pct}
            </span>
            <span className="mono text-[10px]" style={{ color: 'var(--ink-30)' }}>vs last week</span>
          </div>
        </div>

        {/* Net Revenue */}
        <div className="kpi-card p-5" style={{ ...card, borderLeft: `3px solid ${netRevenue >= 0 ? '#0d9488' : '#ef4444'}` }}>
          <p className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--ink-30)' }}>
            Net Revenue
          </p>
          <p className="serif text-[26px] font-bold mt-2 leading-none" style={{ color: netRevenue >= 0 ? '#0d9488' : '#ef4444' }}>
            {netRevenue >= 0 ? '' : '-'}{formatINR(Math.abs(netRevenue))}
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <span
              className="mono text-[10px] px-2 py-0.5 rounded-full"
              style={{
                background: netRevenue >= 0 ? 'rgba(13,148,136,0.1)' : 'rgba(239,68,68,0.1)',
                color: netRevenue >= 0 ? '#0d9488' : '#ef4444',
              }}
            >
              {netRevenue >= 0 ? 'Profitable' : 'Loss'}
            </span>
          </div>
        </div>

        {/* Loss Ratio */}
        <div className="kpi-card p-5" style={{ ...card, borderLeft: `3px solid ${lrColor}` }}>
          <p className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--ink-30)' }}>
            Loss Ratio
          </p>
          <p className="serif text-[26px] font-bold mt-2 leading-none" style={{ color: lrColor }}>
            {(lossRatio * 100).toFixed(1)}%
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <span
              className="mono text-xs font-semibold"
              style={{ color: trends.lr.up ? '#ef4444' : '#0d9488' }}
            >
              {trends.lr.arrow} {trends.lr.pct}
            </span>
            <span className="mono text-[10px]" style={{ color: 'var(--ink-30)' }}>vs last week</span>
          </div>
        </div>

        {/* Burning Cost Rate */}
        <div className="kpi-card p-5" style={{ ...card, borderLeft: `3px solid ${bcrColor}` }}>
          <p className="mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--ink-30)' }}>
            Burning Cost Rate
          </p>
          <p className="serif text-[26px] font-bold mt-2 leading-none" style={{ color: bcrColor }}>
            {bcr.toFixed(3)}
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <span
              className="mono text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{
                background: bcr <= 0.70 ? 'rgba(13,148,136,0.1)' : bcr <= 0.85 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                color: bcrColor,
              }}
            >
              {bcrStatus}
            </span>
          </div>
        </div>
      </div>

      {/* ====== Section 2: BCR Gauge (centered, prominent) ====== */}
      <div className="p-6" style={card}>
        <p className="mono text-[10px] uppercase tracking-widest text-center mb-6" style={{ color: 'var(--ink-30)' }}>
          Burning Cost Rate Gauge
        </p>
        <div className="flex flex-col items-center">
          {/* Gauge */}
          <div
            style={{ width: 200, height: 110, position: 'relative', transition: 'filter 0.3s ease' }}
            onMouseOver={e => { e.currentTarget.style.filter = 'drop-shadow(0 0 8px rgba(13,148,136,0.3))'; }}
            onMouseOut={e => { e.currentTarget.style.filter = 'none'; }}
          >
            {/* Semicircular arc */}
            <div
              style={{
                width: 200,
                height: 200,
                borderRadius: '50%',
                background: `conic-gradient(
                  from 180deg,
                  #0d9488 0deg 99deg,
                  #06b6d4 99deg 126deg,
                  #f59e0b 126deg 153deg,
                  #ef4444 153deg 180deg,
                  transparent 180deg 360deg
                )`,
                position: 'absolute',
                top: 0,
                left: 0,
              }}
            />
            {/* Inner cutout */}
            <div
              style={{
                width: 140,
                height: 140,
                borderRadius: '50%',
                background: 'var(--cream)',
                position: 'absolute',
                top: 30,
                left: 30,
              }}
            />
            {/* Tick marks */}
            {[0, 0.25, 0.55, 0.70, 0.85, 1.0].map((val) => {
              const angle = (val / 1.0) * 180;
              return (
                <div
                  key={val}
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: '50%',
                    width: 2,
                    height: 14,
                    background: 'var(--ink-30)',
                    transformOrigin: 'bottom center',
                    transform: `translateX(-50%) rotate(${angle - 90}deg)`,
                    borderRadius: 1,
                    zIndex: 8,
                    opacity: 0.5,
                  }}
                />
              );
            })}
            {/* Needle */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: '50%',
                width: 3,
                height: 80,
                background: `linear-gradient(to top, ${bcrColor}, ${bcrColor}dd)`,
                transformOrigin: 'bottom center',
                transform: `translateX(-50%) rotate(${bcrAngle - 90}deg)`,
                borderRadius: 2,
                zIndex: 10,
                transition: 'transform 1s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              }}
            />
            {/* Center pivot */}
            <div
              style={{
                position: 'absolute',
                bottom: -6,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: bcrColor,
                border: '2px solid var(--cream)',
                zIndex: 11,
              }}
            />
            {/* Scale labels */}
            <span className="mono" style={{ position: 'absolute', bottom: -4, left: -8, fontSize: 9, color: 'var(--ink-30)' }}>0</span>
            <span className="mono" style={{ position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', fontSize: 9, color: 'var(--ink-30)' }}>0.50</span>
            <span className="mono" style={{ position: 'absolute', bottom: -4, right: -8, fontSize: 9, color: 'var(--ink-30)' }}>1.0</span>
          </div>
          {/* Value display */}
          <div className="mt-4 text-center">
            <p className="serif text-3xl font-bold" style={{ color: bcrColor }}>{bcr.toFixed(3)}</p>
            <p className="mono text-[10px] mt-1.5 tracking-wide" style={{ color: 'var(--ink-30)' }}>
              TARGET: 0.55 - 0.70
            </p>
            <span
              className="mono text-[10px] inline-block mt-2 px-3 py-1 rounded-full font-semibold"
              style={{
                background: bcr <= 0.70 ? 'rgba(13,148,136,0.1)' : bcr <= 0.85 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                color: bcrColor,
                transition: 'transform 0.15s ease',
              }}
              onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.05)'; }}
              onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              {bcrStatus}
            </span>
          </div>
          {/* Zone legend */}
          <div className="flex gap-5 mt-4">
            {[
              { label: 'Green', color: '#0d9488', range: '0 - 0.55' },
              { label: 'Target', color: '#06b6d4', range: '0.55 - 0.70' },
              { label: 'Watch', color: '#f59e0b', range: '0.70 - 0.85' },
              { label: 'Critical', color: '#ef4444', range: '0.85 - 1.00' },
            ].map((z) => (
              <div key={z.label} className="flex items-center gap-1.5">
                <span style={{ width: 8, height: 8, borderRadius: 2, background: z.color, display: 'inline-block' }} />
                <span className="mono text-[10px]" style={{ color: 'var(--ink-30)' }}>{z.label} ({z.range})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ====== Section 3: Premium vs Payouts Dual Bar Chart (8 weeks) ====== */}
      <div className="p-6" style={card}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="serif text-lg font-semibold" style={{ color: 'var(--ink)' }}>Premium vs Payouts</p>
            <p className="mono text-[10px] uppercase tracking-widest mt-0.5" style={{ color: 'var(--ink-30)' }}>8-week comparison</p>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <span style={{ width: 10, height: 10, borderRadius: 3, background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)', display: 'inline-block' }} />
              <span className="mono text-[10px]" style={{ color: 'var(--ink-60)' }}>Premiums</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span style={{ width: 10, height: 10, borderRadius: 3, background: 'linear-gradient(135deg, #0d9488, #06b6d4)', display: 'inline-block' }} />
              <span className="mono text-[10px]" style={{ color: 'var(--ink-60)' }}>Payouts</span>
            </div>
          </div>
        </div>
        {weeklyData.length > 0 ? (
          <div className="flex items-end justify-center" style={{ gap: 16, height: 180 }}>
            {weeklyData.map((w, i) => {
              const premH = Math.max((w.premiums / weeklyMaxVal) * 140, 4);
              const payH = Math.max((w.payouts / weeklyMaxVal) * 140, 4);
              const d = new Date(w.week);
              const label = `${d.toLocaleDateString('en-IN', { month: 'short' })} ${d.getDate()}`;
              return (
                <div key={w.week} className="flex flex-col items-center" style={{ flex: '1 1 0', maxWidth: 80 }}>
                  {/* Amount labels */}
                  <div className="flex gap-1 mb-1">
                    <span className="mono text-[9px] font-medium" style={{ color: '#8b5cf6' }}>
                      {formatINR(w.premiums)}
                    </span>
                  </div>
                  {/* Bars */}
                  <div className="flex items-end" style={{ gap: 4, height: 140 }}>
                    <div
                      className="bar-grow"
                      style={{
                        width: 22,
                        height: premH,
                        borderRadius: '4px 4px 0 0',
                        background: 'linear-gradient(to top, #8b5cf6, #a78bfa)',
                        animationDelay: `${i * 0.08}s`,
                        transition: 'opacity 0.15s ease, transform 0.15s ease',
                        cursor: 'pointer',
                        transformOrigin: 'bottom',
                      }}
                      onMouseOver={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'scaleY(1.03)'; }}
                      onMouseOut={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scaleY(1)'; }}
                    />
                    <div
                      className="bar-grow"
                      style={{
                        width: 22,
                        height: payH,
                        borderRadius: '4px 4px 0 0',
                        background: 'linear-gradient(to top, #0d9488, #06b6d4)',
                        animationDelay: `${i * 0.08 + 0.04}s`,
                        transition: 'opacity 0.15s ease, transform 0.15s ease',
                        cursor: 'pointer',
                        transformOrigin: 'bottom',
                      }}
                      onMouseOver={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'scaleY(1.03)'; }}
                      onMouseOut={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scaleY(1)'; }}
                    />
                  </div>
                  {/* Week label */}
                  <span className="mono text-[10px] mt-2" style={{ color: 'var(--ink-30)' }}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-center py-12 mono text-sm" style={{ color: 'var(--ink-30)' }}>No weekly data available</p>
        )}
      </div>

      {/* ====== Section 4 + 5: Monthly Payouts + Loss Ratio Trend ====== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Section 4: Monthly Payouts */}
        <div className="p-6" style={card}>
          <p className="serif text-lg font-semibold" style={{ color: 'var(--ink)' }}>Monthly Payouts</p>
          <p className="mono text-[10px] uppercase tracking-widest mt-0.5 mb-5" style={{ color: 'var(--ink-30)' }}>
            Last {monthlyPayouts.length} months
          </p>
          {monthlyPayouts.length > 0 ? (
            <div className="flex items-end justify-around" style={{ height: 180 }}>
              {monthlyPayouts.map(([key, amount], i) => {
                const monthIdx = parseInt(key.split('-')[1], 10);
                const label = MONTH_NAMES[monthIdx] || key;
                const heightPx = Math.max((amount / monthlyMax) * 140, 6);
                return (
                  <div key={key} className="flex flex-col items-center" style={{ flex: '1 1 0', maxWidth: 72 }}>
                    <span className="mono text-[10px] font-semibold mb-1" style={{ color: '#0d9488' }}>
                      {formatINR(amount)}
                    </span>
                    <div
                      className="bar-grow w-full"
                      style={{
                        height: heightPx,
                        borderRadius: '4px 4px 0 0',
                        background: 'linear-gradient(to top, #0d9488, #06b6d4)',
                        maxWidth: 48,
                        animationDelay: `${i * 0.12}s`,
                        transition: 'opacity 0.15s ease, transform 0.15s ease',
                        cursor: 'pointer',
                        transformOrigin: 'bottom',
                      }}
                      onMouseOver={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'scaleY(1.03)'; }}
                      onMouseOut={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scaleY(1)'; }}
                    />
                    <span className="mono text-[10px] mt-2 font-medium" style={{ color: 'var(--ink-30)' }}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12" style={{ color: 'var(--ink-30)' }}>
              <p className="mono text-sm">No payout data</p>
            </div>
          )}
        </div>

        {/* Section 5: Loss Ratio Trend */}
        <div className="p-6" style={card}>
          <p className="serif text-lg font-semibold" style={{ color: 'var(--ink)' }}>Loss Ratio Trend</p>
          <p className="mono text-[10px] uppercase tracking-widest mt-0.5 mb-5" style={{ color: 'var(--ink-30)' }}>
            Weekly &middot; Target 70%
          </p>
          {weeklyData.length > 0 ? (
            <div style={{ position: 'relative', height: 180, paddingBottom: 24 }}>
              {/* Target line at 70% */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: `${(0.70 / 1.0) * 140 + 24}px`,
                  borderTop: '1.5px dashed #f59e0b',
                  zIndex: 2,
                }}
              >
                <span
                  className="mono text-[9px] font-semibold"
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: -14,
                    color: '#f59e0b',
                    background: 'var(--cream)',
                    padding: '0 4px',
                  }}
                >
                  Target 70%
                </span>
              </div>
              {/* Connecting line */}
              <svg
                style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', zIndex: 1, overflow: 'visible' }}
                preserveAspectRatio="none"
              >
                <polyline
                  fill="none"
                  stroke="var(--ink-10)"
                  strokeWidth="2"
                  points={weeklyData.map((w, i) => {
                    const x = weeklyData.length > 1
                      ? 24 + (i / (weeklyData.length - 1)) * (100 - 6)
                      : 50;
                    const y = 140 - Math.min(w.lossRatio, 1.0) * 140 + 10;
                    return `${x}%,${y}`;
                  }).join(' ')}
                />
              </svg>
              {/* Data points */}
              <div style={{ position: 'relative', height: '100%' }}>
                {weeklyData.map((w, i) => {
                  const xPct = weeklyData.length > 1
                    ? 3 + (i / (weeklyData.length - 1)) * 94
                    : 50;
                  const bottomPx = Math.min(w.lossRatio, 1.0) * 140 + 24;
                  const dotColor = w.lossRatio <= 0.70 ? '#0d9488' : w.lossRatio <= 0.85 ? '#f59e0b' : '#ef4444';
                  const shortWeek = w.week.slice(5);
                  return (
                    <div key={w.week}>
                      {/* Dot */}
                      <div
                        className="fade-up"
                        style={{
                          position: 'absolute',
                          left: `${xPct}%`,
                          bottom: bottomPx,
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          background: dotColor,
                          border: '2px solid var(--cream)',
                          transform: 'translate(-50%, 50%)',
                          zIndex: 5,
                          animationDelay: `${i * 0.1}s`,
                          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                          cursor: 'pointer',
                        }}
                        onMouseOver={e => { e.currentTarget.style.transform = 'translate(-50%, 50%) scale(1.4)'; e.currentTarget.style.boxShadow = `0 0 8px ${dotColor}80`; }}
                        onMouseOut={e => { e.currentTarget.style.transform = 'translate(-50%, 50%)'; e.currentTarget.style.boxShadow = 'none'; }}
                      />
                      {/* Value above dot */}
                      <span
                        className="mono text-[10px] font-semibold fade-up"
                        style={{
                          position: 'absolute',
                          left: `${xPct}%`,
                          bottom: bottomPx + 14,
                          transform: 'translateX(-50%)',
                          color: dotColor,
                          whiteSpace: 'nowrap',
                          animationDelay: `${i * 0.1}s`,
                        }}
                      >
                        {(w.lossRatio * 100).toFixed(0)}%
                      </span>
                      {/* Week label below */}
                      <span
                        className="mono text-[9px]"
                        style={{
                          position: 'absolute',
                          left: `${xPct}%`,
                          bottom: 0,
                          transform: 'translateX(-50%)',
                          color: 'var(--ink-30)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {shortWeek}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-center py-12 mono text-sm" style={{ color: 'var(--ink-30)' }}>No weekly data available</p>
          )}
        </div>
      </div>

      {/* ====== Section 6 + 7: Zone Breakdown + Revenue Donut ====== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Section 6: Zone-wise Payout Breakdown */}
        <div className="p-6" style={card}>
          <p className="serif text-lg font-semibold" style={{ color: 'var(--ink)' }}>Zone-wise Payouts</p>
          <p className="mono text-[10px] uppercase tracking-widest mt-0.5 mb-5" style={{ color: 'var(--ink-30)' }}>
            By city &middot; sorted by amount
          </p>
          {zonePayouts.length > 0 ? (
            <div className="space-y-3">
              {zonePayouts.slice(0, 8).map(({ city, amount, pct }, i) => (
                <div key={city}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="mono text-xs font-medium" style={{ color: 'var(--ink-60)' }}>{city}</span>
                    <div className="flex items-center gap-2">
                      <span className="mono text-xs font-semibold" style={{ color: '#0d9488' }}>
                        {formatINR(amount)}
                      </span>
                      <span
                        className="mono text-[10px] px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(13,148,136,0.08)', color: '#0d9488', transition: 'transform 0.15s ease', display: 'inline-block' }}
                        onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                        onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                      >
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-3 rounded-full" style={{ background: 'var(--ink-10)' }}>
                    <div
                      className="h-full rounded-full bar-grow-x"
                      style={{
                        width: `${(amount / zoneMax) * 100}%`,
                        background: 'linear-gradient(to right, #0d9488, #06b6d4)',
                        minWidth: 4,
                        animationDelay: `${i * 0.1}s`,
                        transition: 'opacity 0.15s ease, transform 0.15s ease',
                        cursor: 'pointer',
                        transformOrigin: 'left',
                      }}
                      onMouseOver={e => { e.currentTarget.style.transform = 'scaleX(1.02)'; e.currentTarget.style.opacity = '0.85'; }}
                      onMouseOut={e => { e.currentTarget.style.transform = 'scaleX(1)'; e.currentTarget.style.opacity = '1'; }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12" style={{ color: 'var(--ink-30)' }}>
              <p className="mono text-sm">No zone data available</p>
            </div>
          )}
        </div>

        {/* Section 7: Revenue Breakdown Donut */}
        <div className="p-6" style={card}>
          <p className="serif text-lg font-semibold" style={{ color: 'var(--ink)' }}>Revenue Breakdown</p>
          <p className="mono text-[10px] uppercase tracking-widest mt-0.5 mb-5" style={{ color: 'var(--ink-30)' }}>
            Premiums allocation
          </p>
          <div className="flex flex-col items-center">
            {/* Donut */}
            <div style={{ position: 'relative', width: 160, height: 160, transition: 'transform 0.3s ease' }} onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.03)'; }} onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; }}>
              <div
                style={{
                  width: 160,
                  height: 160,
                  borderRadius: '50%',
                  background: `conic-gradient(
                    #0d9488 0deg ${(donutData.payoutPct / 100) * 360}deg,
                    ${netRevenue >= 0 ? '#8b5cf6' : '#ef4444'} ${(donutData.payoutPct / 100) * 360}deg ${((donutData.payoutPct + donutData.netPct) / 100) * 360}deg,
                    #f59e0b ${((donutData.payoutPct + donutData.netPct) / 100) * 360}deg 360deg
                  )`,
                }}
              />
              {/* Inner hole */}
              <div
                style={{
                  position: 'absolute',
                  top: 32,
                  left: 32,
                  width: 96,
                  height: 96,
                  borderRadius: '50%',
                  background: 'var(--cream)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span className="serif text-lg font-bold" style={{ color: 'var(--ink)' }}>
                  {formatINR(totalPremiums)}
                </span>
                <span className="mono text-[9px]" style={{ color: 'var(--ink-30)' }}>TOTAL</span>
              </div>
            </div>
            {/* Legend */}
            <div className="flex flex-col gap-2.5 mt-5 w-full max-w-[240px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: '#0d9488', display: 'inline-block' }} />
                  <span className="mono text-xs" style={{ color: 'var(--ink-60)' }}>Payouts</span>
                </div>
                <span className="mono text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                  {formatINR(totalPayouts)} ({donutData.payoutPct.toFixed(1)}%)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: netRevenue >= 0 ? '#8b5cf6' : '#ef4444', display: 'inline-block' }} />
                  <span className="mono text-xs" style={{ color: 'var(--ink-60)' }}>Net Revenue</span>
                </div>
                <span className="mono text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                  {formatINR(Math.abs(netRevenue))} ({donutData.netPct.toFixed(1)}%)
                </span>
              </div>
              {donutData.failedPct > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: '#f59e0b', display: 'inline-block' }} />
                    <span className="mono text-xs" style={{ color: 'var(--ink-60)' }}>Uncollected</span>
                  </div>
                  <span className="mono text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                    {formatINR(donutData.failedAmt)} ({donutData.failedPct.toFixed(1)}%)
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ====== Section 8: Failed Payments ====== */}
      <div className="p-6" style={card}>
        <p className="serif text-lg font-semibold" style={{ color: 'var(--ink)' }}>Payment Status</p>
        <p className="mono text-[10px] uppercase tracking-widest mt-0.5 mb-5" style={{ color: 'var(--ink-30)' }}>
          Failed &amp; pending payments
        </p>
        {failedPolicies.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px' }}>
              <thead>
                <tr>
                  {['Policy ID', 'Driver', 'Amount', 'Week', 'Status'].map((h) => (
                    <th
                      key={h}
                      className="mono text-[10px] uppercase tracking-widest text-left px-4 py-2"
                      style={{ color: 'var(--ink-30)', borderBottom: '1px solid var(--rule)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {failedPolicies.slice(0, 20).map((p) => (
                  <tr key={p.id} className="admin-row" style={{ borderRadius: 8, transition: 'background 0.15s ease', cursor: 'pointer' }}>
                    <td className="mono text-xs px-4 py-2.5" style={{ color: 'var(--ink-60)' }}>
                      {p.id.slice(0, 8)}...
                    </td>
                    <td className="mono text-xs px-4 py-2.5" style={{ color: 'var(--ink-60)' }}>
                      {p.profile_id.slice(0, 8)}...
                    </td>
                    <td className="mono text-xs px-4 py-2.5 font-semibold" style={{ color: '#ef4444' }}>
                      {formatINR(Number(p.final_premium_inr))}
                    </td>
                    <td className="mono text-xs px-4 py-2.5" style={{ color: 'var(--ink-60)' }}>
                      {p.week_start_date}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="mono text-[10px] font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', transition: 'transform 0.15s ease', display: 'inline-block' }}
                        onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                        onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                      >
                        Failed
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div
            className="flex items-center gap-3 p-4 rounded-xl"
            style={{ background: 'rgba(13,148,136,0.06)', border: '1px solid rgba(13,148,136,0.15)' }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'rgba(13,148,136,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: 16,
                color: '#0d9488',
              }}
            >
              &#10003;
            </div>
            <div>
              <p className="sans text-sm font-medium" style={{ color: '#0d9488' }}>
                No failed payments
              </p>
              <p className="mono text-[10px] mt-0.5" style={{ color: 'var(--ink-30)' }}>
                100% collection rate across all {policies.length} policies
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
