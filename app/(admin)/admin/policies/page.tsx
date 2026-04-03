'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CITIES } from '@/lib/config/cities';
import { TIER_TYPES } from '@/lib/config/constants';
import type { TierType } from '@/lib/config/constants';

/* ---------- Types ---------- */

interface PolicyRow {
  id: string;
  profile_id: string;
  plan_id: string | null;
  week_start_date: string;
  week_end_date: string;
  base_premium_inr: number;
  weather_risk_addon: number;
  ubi_addon: number;
  final_premium_inr: number;
  is_active: boolean;
  payment_status: string;
  total_payout_this_week: number;
  created_at: string;
  profiles: { full_name: string | null; city: string | null } | null;
  plan_packages: { name: string; tier: string } | null;
}

interface PremiumResult {
  base_premium?: number;
  weather_risk_addon?: number;
  ubi_addon?: number;
  final_premium?: number;
  ubi_details?: { weighted_risk_score: number; risk_level: string; zone_contributions: Array<{ zone_name: string; risk_score: number; time_percentage: number }> };
  breakdown?: { rainfall_probability: number; wind_probability: number; aqi_probability: number; combined_risk_score: number };
  error?: string;
}

/* ---------- Constants ---------- */

const TIER_COLORS: Record<string, { border: string; color: string }> = {
  normal: { border: '1px solid var(--teal)', color: 'var(--teal)' },
  medium: { border: '1px solid #f59e0b', color: '#f59e0b' },
  high: { border: '1px solid var(--red-acc)', color: 'var(--red-acc)' },
};

const TIER_DONUT_COLORS: Record<string, string> = {
  normal: 'var(--teal)',
  medium: '#f59e0b',
  high: 'var(--red-acc)',
};

const PAYMENT_STATUS_STYLES: Record<string, { border: string; color: string }> = {
  paid: { border: '1px solid var(--teal)', color: 'var(--teal)' },
  demo: { border: '1px solid var(--teal)', color: 'var(--teal)' },
  pending: { border: '1px solid #f59e0b', color: '#f59e0b' },
  failed: { border: '1px solid var(--red-acc)', color: 'var(--red-acc)' },
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

export default function AdminPoliciesPage() {
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Table sort and filter
  const [sortField, setSortField] = useState<'week_start_date' | 'final_premium_inr' | 'total_payout_this_week'>('week_start_date');
  const [sortAsc, setSortAsc] = useState(false);
  const [filterCity, setFilterCity] = useState('all');
  const [filterTier, setFilterTier] = useState('all');

  // Premium calculator state
  const [calcCity, setCalcCity] = useState(CITIES[0].slug);
  const [calcTier, setCalcTier] = useState<TierType>('normal');
  const [calcDriverId, setCalcDriverId] = useState('');
  const [calcDate, setCalcDate] = useState(new Date().toISOString().split('T')[0]);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcResult, setCalcResult] = useState<PremiumResult | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data, error: fetchErr } = await supabase
          .from('weekly_policies')
          .select('*, profiles(full_name, city), plan_packages(name, tier)')
          .order('created_at', { ascending: false });

        if (fetchErr) throw fetchErr;
        setPolicies((data as unknown as PolicyRow[]) || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load policies');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  /* --- Computed analytics --- */

  const activePolicies = useMemo(() => policies.filter((p) => p.is_active), [policies]);

  const tierCounts = useMemo(() => {
    const counts: Record<string, number> = { normal: 0, medium: 0, high: 0 };
    for (const p of activePolicies) {
      const tier = p.plan_packages?.tier || 'normal';
      counts[tier] = (counts[tier] || 0) + 1;
    }
    return counts;
  }, [activePolicies]);

  const cityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of activePolicies) {
      const city = p.profiles?.city || 'Unknown';
      counts[city] = (counts[city] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [activePolicies]);

  const cityMaxCount = cityCounts.length > 0 ? cityCounts[0][1] : 1;

  // Weekly trend (this week vs last week)
  const weeklyTrend = useMemo(() => {
    const now = new Date();
    const startOfThisWeek = new Date(now);
    startOfThisWeek.setDate(now.getDate() - now.getDay());
    startOfThisWeek.setHours(0, 0, 0, 0);
    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

    let thisWeek = 0;
    let lastWeek = 0;
    for (const p of policies) {
      const created = new Date(p.created_at);
      if (created >= startOfThisWeek) thisWeek++;
      else if (created >= startOfLastWeek && created < startOfThisWeek) lastWeek++;
    }
    const diff = thisWeek - lastWeek;
    return { thisWeek, lastWeek, diff };
  }, [policies]);

  // Donut gradient for tiers
  const tierDonutGradient = useMemo(() => {
    const total = activePolicies.length || 1;
    const segments: string[] = [];
    let cumulative = 0;
    for (const tier of TIER_TYPES) {
      const count = tierCounts[tier] || 0;
      const pct = (count / total) * 100;
      const color = TIER_DONUT_COLORS[tier] || '#ccc';
      segments.push(`${color} ${cumulative}% ${cumulative + pct}%`);
      cumulative += pct;
    }
    return `conic-gradient(${segments.join(', ')})`;
  }, [activePolicies.length, tierCounts]);

  // Unique cities
  const policyCities = useMemo(() => {
    const set = new Set<string>();
    for (const p of policies) {
      if (p.profiles?.city) set.add(p.profiles.city);
    }
    return [...set].sort();
  }, [policies]);

  // Sorted and filtered policies
  const displayPolicies = useMemo(() => {
    let filtered = policies.filter((p) => {
      if (filterCity !== 'all' && p.profiles?.city !== filterCity) return false;
      if (filterTier !== 'all' && p.plan_packages?.tier !== filterTier) return false;
      return true;
    });
    filtered.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortAsc ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal || '');
      const bStr = String(bVal || '');
      return sortAsc ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
    return filtered;
  }, [policies, filterCity, filterTier, sortField, sortAsc]);

  function handleSort(field: typeof sortField) {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  }

  /* --- Premium Calculator --- */

  async function handleCalculatePremium() {
    setCalcLoading(true);
    setCalcResult(null);
    try {
      const mlUrl = process.env.NEXT_PUBLIC_ML_SERVICE_URL || 'http://localhost:8001';
      const res = await fetch(`${mlUrl}/predict/premium`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: calcCity,
          tier: calcTier,
          driver_id: calcDriverId || undefined,
          date: calcDate,
        }),
      });
      const data = (await res.json()) as PremiumResult;
      setCalcResult(data);
    } catch (err) {
      setCalcResult({ error: err instanceof Error ? err.message : 'Failed to calculate' });
    } finally {
      setCalcLoading(false);
    }
  }

  /* --- Loading / Error --- */

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="serif text-2xl font-bold">Policy Center</h1>
        <div className="rounded-2xl p-5" style={{ background: 'rgba(192,57,43,0.06)', border: '1px solid var(--red-acc)' }}>
          <p className="font-medium" style={{ color: 'var(--red-acc)' }}>Failed to load data</p>
          <p className="text-sm mt-1" style={{ color: 'var(--red-acc)' }}>{error}</p>
        </div>
      </div>
    );
  }

  const sortIcon = (field: typeof sortField) => {
    if (sortField !== field) return '';
    return sortAsc ? ' \u2191' : ' \u2193';
  };

  return (
    <div className="space-y-6">
      <h1 className="serif text-2xl font-bold">Policy Center</h1>

      {/* --- Policy Analytics --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Active */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--cream)', border: '1px solid var(--rule)', transition: 'all 0.2s ease' }} onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(17,16,16,0.08)'; }} onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
          <p className="mono text-xs uppercase tracking-wide" style={{ color: 'var(--ink-60)' }}>Active Policies</p>
          <p className="serif text-3xl font-bold mt-2" style={{ color: 'var(--ink)' }}>{activePolicies.length}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--ink-30)' }}>of {policies.length} total</p>
        </div>

        {/* Tier Donut */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--cream)', border: '1px solid var(--rule)', transition: 'all 0.2s ease' }} onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(17,16,16,0.08)'; }} onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
          <p className="mono text-xs uppercase tracking-wide mb-3" style={{ color: 'var(--ink-60)' }}>By Tier</p>
          <div className="flex items-center gap-4">
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: tierDonutGradient,
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
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--cream)',
                }}
              />
            </div>
            <div className="space-y-1 text-xs">
              {TIER_TYPES.map((t) => (
                <div key={t} className="flex items-center gap-1.5">
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: TIER_DONUT_COLORS[t], display: 'inline-block', flexShrink: 0 }} />
                  <span className="mono capitalize" style={{ color: 'var(--ink-60)' }}>{t}: {tierCounts[t] || 0}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* City Bar */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--cream)', border: '1px solid var(--rule)', transition: 'all 0.2s ease' }} onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(17,16,16,0.08)'; }} onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
          <p className="mono text-xs uppercase tracking-wide mb-3" style={{ color: 'var(--ink-60)' }}>By City</p>
          <div className="space-y-1.5">
            {cityCounts.slice(0, 5).map(([city, count]) => (
              <div key={city} className="flex items-center gap-2">
                <span className="mono text-xs w-16 truncate" style={{ color: 'var(--ink-60)' }}>{city}</span>
                <div className="flex-1 h-3 rounded" style={{ background: 'var(--ink-10)' }}>
                  <div
                    className="h-full rounded"
                    style={{ width: `${(count / cityMaxCount) * 100}%`, background: 'var(--teal)', minWidth: 4, transition: 'all 0.15s ease', cursor: 'pointer', transformOrigin: 'left' }}
                    onMouseOver={e => { e.currentTarget.style.transform = 'scaleX(1.02)'; e.currentTarget.style.opacity = '0.85'; }}
                    onMouseOut={e => { e.currentTarget.style.transform = 'scaleX(1)'; e.currentTarget.style.opacity = '1'; }}
                  />
                </div>
                <span className="serif text-xs w-5 text-right" style={{ color: 'var(--ink)' }}>{count}</span>
              </div>
            ))}
            {cityCounts.length === 0 && <p className="text-xs" style={{ color: 'var(--ink-30)' }}>No data</p>}
          </div>
        </div>

        {/* Weekly Trend */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--cream)', border: '1px solid var(--rule)', transition: 'all 0.2s ease' }} onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(17,16,16,0.08)'; }} onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
          <p className="mono text-xs uppercase tracking-wide" style={{ color: 'var(--ink-60)' }}>New This Week</p>
          <p className="serif text-3xl font-bold mt-2" style={{ color: 'var(--ink)' }}>{weeklyTrend.thisWeek}</p>
          <p className="text-xs mt-1" style={{ color: weeklyTrend.diff >= 0 ? 'var(--teal)' : 'var(--red-acc)' }}>
            {weeklyTrend.diff >= 0 ? '+' : ''}{weeklyTrend.diff} vs last week ({weeklyTrend.lastWeek})
          </p>
        </div>
      </div>

      {/* --- Dynamic Premium Calculator --- */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--cream)', border: '1px solid var(--rule)' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--rule)' }}>
          <h2 className="serif text-lg font-bold" style={{ color: 'var(--ink)' }}>Dynamic Premium Calculator</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-60)' }}>Test ML premium predictions for any combination.</p>
        </div>
        <div className="p-5">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Row 1: City, Tier, Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div>
                <label className="mono block text-xs font-medium mb-1" style={{ color: 'var(--ink)' }}>City</label>
                <select
                  value={calcCity}
                  onChange={(e) => setCalcCity(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ border: '1px solid var(--rule)', background: 'var(--cream)' }}
                >
                  {CITIES.map((c) => (
                    <option key={c.slug} value={c.slug}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mono block text-xs font-medium mb-1" style={{ color: 'var(--ink)' }}>Tier</label>
                <select
                  value={calcTier}
                  onChange={(e) => setCalcTier(e.target.value as TierType)}
                  className="w-full rounded-lg px-3 py-2 text-sm capitalize"
                  style={{ border: '1px solid var(--rule)', background: 'var(--cream)' }}
                >
                  {TIER_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mono block text-xs font-medium mb-1" style={{ color: 'var(--ink)' }}>Date</label>
                <input
                  type="date"
                  value={calcDate}
                  onChange={(e) => setCalcDate(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ border: '1px solid var(--rule)', background: 'var(--cream)' }}
                />
              </div>
            </div>
            {/* Row 2: Driver ID — full width */}
            <div>
              <label className="mono block text-xs font-medium mb-1" style={{ color: 'var(--ink)' }}>Driver (for UBI zone lookup)</label>
              <select
                value={calcDriverId}
                onChange={(e) => setCalcDriverId(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ border: '1px solid var(--rule)', background: 'var(--cream)' }}
              >
                <option value="">Select a driver</option>
                <option value="aaaaaaaa-1111-1111-1111-111111111111">Rajesh Kumar — Mumbai (Kurla/Sion, high risk)</option>
                <option value="aaaaaaaa-2222-2222-2222-222222222222">Priya Sharma — Delhi (Anand Vihar, AQI hotspot)</option>
                <option value="aaaaaaaa-3333-3333-3333-333333333333">Suresh Patel — Bangalore (Whitefield)</option>
                <option value="aaaaaaaa-4444-4444-4444-444444444444">Meera Devi — Chennai (Velachery, cyclone risk)</option>
                <option value="aaaaaaaa-5555-5555-5555-555555555555">Amit Singh — Pune (Katraj, flood risk)</option>
                <option value="aaaaaaaa-6666-6666-6666-666666666666">Lakshmi Rao — Hyderabad (Gachibowli, low risk)</option>
                <option value="aaaaaaaa-7777-7777-7777-777777777777">Vikram Tiwari — Kolkata (Diamond Harbour, cyclone)</option>
              </select>
              <p className="mono text-xs mt-1" style={{ color: 'var(--ink-30)' }}>Required — determines zone-based UBI premium adjustment</p>
            </div>
          </div>
          <button
            onClick={handleCalculatePremium}
            disabled={calcLoading}
            className="mt-4 text-white font-medium px-6 py-2.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ background: 'var(--teal)', transition: 'all 0.2s ease' }}
            onMouseOver={e => { if (!calcLoading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(13,148,136,0.3)'; } }}
            onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            {calcLoading ? 'Calculating...' : 'Calculate Premium'}
          </button>

          {calcResult && (
            <div className="mt-4">
              {calcResult.error ? (
                <div className="rounded-xl p-4" style={{ background: 'rgba(192,57,43,0.06)', border: '1px solid var(--red-acc)' }}>
                  <p className="text-sm font-medium" style={{ color: 'var(--red-acc)' }}>Error</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--red-acc)' }}>{calcResult.error}</p>
                </div>
              ) : (
                <div className="rounded-xl p-5" style={{ background: 'var(--teal-bg)', border: '1px solid var(--teal)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                    {/* Left: Premium Breakdown */}
                    <div>
                      <div className="flex items-baseline gap-2 mb-4">
                        <span className="mono text-xs" style={{ color: 'var(--teal-d)' }}>Final Premium:</span>
                        <span className="serif text-3xl font-bold" style={{ color: 'var(--teal-d)' }}>
                          &#8377;{Number(calcResult.final_premium || 0).toFixed(0)}
                        </span>
                        <span className="sans text-sm" style={{ color: 'var(--ink-60)' }}>/week</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--cream)', borderRadius: 8 }}>
                          <span className="mono text-xs" style={{ color: 'var(--ink-60)' }}>Base Premium</span>
                          <span className="serif font-bold" style={{ color: 'var(--ink)' }}>&#8377;{Number(calcResult.base_premium || 0).toFixed(0)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--cream)', borderRadius: 8 }}>
                          <span className="mono text-xs" style={{ color: 'var(--ink-60)' }}>Weather Risk Addon</span>
                          <span className="serif font-bold" style={{ color: '#f59e0b' }}>+&#8377;{Number(calcResult.weather_risk_addon || 0).toFixed(0)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--cream)', borderRadius: 8 }}>
                          <span className="mono text-xs" style={{ color: 'var(--ink-60)' }}>UBI Zone Addon</span>
                          <span className="serif font-bold" style={{ color: '#8b5cf6' }}>+&#8377;{Number(calcResult.ubi_addon || 0).toFixed(0)}</span>
                        </div>
                      </div>
                      {calcResult.breakdown && (
                        <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--cream)', borderRadius: 8 }}>
                          <p className="mono text-xs mb-2" style={{ color: 'var(--ink-60)' }}>Disruption Probabilities</p>
                          <div style={{ display: 'flex', gap: 16 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                <span className="mono text-xs" style={{ color: 'var(--ink-30)' }}>Rainfall</span>
                                <span className="mono text-xs font-bold" style={{ color: 'var(--ink)' }}>{(calcResult.breakdown.rainfall_probability * 100).toFixed(1)}%</span>
                              </div>
                              <div style={{ height: 4, background: 'var(--ink-10)', borderRadius: 2 }}>
                                <div style={{ height: 4, borderRadius: 2, background: 'var(--teal)', width: `${Math.max(calcResult.breakdown.rainfall_probability * 100, 1)}%`, transition: 'width 0.5s ease' }} />
                              </div>
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                <span className="mono text-xs" style={{ color: 'var(--ink-30)' }}>Wind</span>
                                <span className="mono text-xs font-bold" style={{ color: 'var(--ink)' }}>{(calcResult.breakdown.wind_probability * 100).toFixed(1)}%</span>
                              </div>
                              <div style={{ height: 4, background: 'var(--ink-10)', borderRadius: 2 }}>
                                <div style={{ height: 4, borderRadius: 2, background: '#f59e0b', width: `${Math.max(calcResult.breakdown.wind_probability * 100, 1)}%`, transition: 'width 0.5s ease' }} />
                              </div>
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                <span className="mono text-xs" style={{ color: 'var(--ink-30)' }}>AQI</span>
                                <span className="mono text-xs font-bold" style={{ color: 'var(--ink)' }}>{(calcResult.breakdown.aqi_probability * 100).toFixed(1)}%</span>
                              </div>
                              <div style={{ height: 4, background: 'var(--ink-10)', borderRadius: 2 }}>
                                <div style={{ height: 4, borderRadius: 2, background: '#ef4444', width: `${Math.max(calcResult.breakdown.aqi_probability * 100, 1)}%`, transition: 'width 0.5s ease' }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Right: Zone Risk Details */}
                    <div>
                      {calcResult.ubi_details && (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <span className="mono text-xs" style={{ color: 'var(--ink-60)' }}>Zone Risk Score:</span>
                            <span className="serif text-lg font-bold" style={{ color: calcResult.ubi_details.risk_level === 'high' ? '#ef4444' : calcResult.ubi_details.risk_level === 'medium' ? '#f59e0b' : 'var(--teal)' }}>
                              {(calcResult.ubi_details.weighted_risk_score * 100).toFixed(1)}%
                            </span>
                            <span className="mono text-xs px-2 py-0.5 rounded" style={{ border: '1px solid var(--rule)', color: 'var(--ink-60)' }}>
                              {calcResult.ubi_details.risk_level.toUpperCase()}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {calcResult.ubi_details.zone_contributions.map((z) => (
                              <div key={z.zone_name} style={{ padding: '8px 12px', background: 'var(--cream)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <span className="sans text-sm font-medium" style={{ color: 'var(--ink)' }}>{z.zone_name}</span>
                                  <span className="mono text-xs ml-2" style={{ color: 'var(--ink-30)' }}>{z.time_percentage}% trips</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <div style={{ width: 40, height: 4, background: 'var(--ink-10)', borderRadius: 2 }}>
                                    <div style={{ height: 4, borderRadius: 2, width: `${z.risk_score * 100}%`, background: z.risk_score > 0.7 ? '#ef4444' : z.risk_score > 0.5 ? '#f59e0b' : 'var(--teal)' }} />
                                  </div>
                                  <span className="mono text-xs font-bold" style={{ color: z.risk_score > 0.7 ? '#ef4444' : z.risk_score > 0.5 ? '#f59e0b' : 'var(--teal)' }}>
                                    {(z.risk_score * 100).toFixed(0)}%
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* --- Policy Table --- */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--cream)', border: '1px solid var(--rule)' }}>
        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" style={{ borderBottom: '1px solid var(--rule)' }}>
          <h2 className="serif text-lg font-bold" style={{ color: 'var(--ink)' }}>All Policies</h2>
          <div className="flex gap-2 flex-wrap">
            <select
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              className="mono text-xs rounded-lg px-3 py-1.5"
              style={{ border: '1px solid var(--rule)', background: 'var(--cream)' }}
            >
              <option value="all">All Cities</option>
              {policyCities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              value={filterTier}
              onChange={(e) => setFilterTier(e.target.value)}
              className="mono text-xs rounded-lg px-3 py-1.5 capitalize"
              style={{ border: '1px solid var(--rule)', background: 'var(--cream)' }}
            >
              <option value="all">All Tiers</option>
              {TIER_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ background: 'var(--cream-d)', color: 'var(--ink-60)' }}>
                <th className="px-4 py-3 font-medium">Driver</th>
                <th className="px-4 py-3 font-medium">City</th>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th
                  className="px-4 py-3 font-medium cursor-pointer select-none"
                  onClick={() => handleSort('final_premium_inr')}
                >
                  Premium{sortIcon('final_premium_inr')}
                </th>
                <th
                  className="px-4 py-3 font-medium cursor-pointer select-none"
                  onClick={() => handleSort('week_start_date')}
                >
                  Week{sortIcon('week_start_date')}
                </th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th
                  className="px-4 py-3 font-medium cursor-pointer select-none"
                  onClick={() => handleSort('total_payout_this_week')}
                >
                  Payout{sortIcon('total_payout_this_week')}
                </th>
              </tr>
            </thead>
            <tbody>
              {displayPolicies.map((p) => {
                const tierStyle = TIER_COLORS[p.plan_packages?.tier || 'normal'] || TIER_COLORS.normal;
                const paymentStyle = PAYMENT_STATUS_STYLES[p.payment_status] || { border: '1px solid var(--ink-60)', color: 'var(--ink-60)' };
                return (
                  <tr key={p.id} className="admin-row" style={{ borderTop: '1px solid var(--ink-10)', transition: 'background 0.15s ease', cursor: 'pointer' }}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--ink)' }}>
                      {p.profiles?.full_name || 'Unknown'}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--ink-60)' }}>
                      {p.profiles?.city || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="mono text-xs font-medium px-2 py-1 rounded-full capitalize" style={{ ...tierStyle, transition: 'transform 0.15s ease', display: 'inline-block' }} onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.05)'; }} onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; }}>
                        {p.plan_packages?.name || p.plan_packages?.tier || '-'}
                      </span>
                    </td>
                    <td className="serif px-4 py-3 font-medium" style={{ color: 'var(--ink)' }}>
                      &#8377;{Number(p.final_premium_inr).toLocaleString()}
                    </td>
                    <td className="mono px-4 py-3 text-xs" style={{ color: 'var(--ink-60)' }}>
                      {p.week_start_date}
                    </td>
                    <td className="px-4 py-3">
                      <span className="mono text-xs font-medium px-2 py-1 rounded-full" style={{ ...paymentStyle, transition: 'transform 0.15s ease', display: 'inline-block' }} onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.05)'; }} onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; }}>
                        {p.payment_status}
                      </span>
                    </td>
                    <td className="serif px-4 py-3 font-medium" style={{ color: p.total_payout_this_week > 0 ? 'var(--teal)' : 'var(--ink-30)' }}>
                      &#8377;{Number(p.total_payout_this_week).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
              {displayPolicies.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center" style={{ color: 'var(--ink-30)' }}>
                    No policies found
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
