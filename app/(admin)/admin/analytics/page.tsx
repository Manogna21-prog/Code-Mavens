import { createAdminClient } from '@/lib/supabase/admin';
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { TRIGGERS } from '@/lib/config/constants';
import type { DisruptionType } from '@/lib/config/constants';

interface PremiumRec {
  id: string;
  profile_id: string;
  week_start_date: string;
  base_premium: number;
  weather_risk: number;
  ubi_adjustment: number;
  final_premium: number;
  reasoning: string | null;
}

interface ClaimTrend {
  event_type: string;
  city: string;
  count: number;
}

export default async function AdminAnalyticsPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient();

  const { data: profileData } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if ((profileData as { role: string } | null)?.role !== 'admin') redirect('/dashboard');

  // Premium recommendations
  const { data: recsData } = await admin
    .from('premium_recommendations')
    .select('id, profile_id, week_start_date, base_premium, weather_risk, ubi_adjustment, final_premium, reasoning')
    .order('created_at', { ascending: false })
    .limit(20);

  const recommendations = (recsData as unknown as PremiumRec[]) || [];

  // Per-city risk from live events
  const { data: eventsData } = await admin
    .from('live_disruption_events')
    .select('event_type, city, severity_score')
    .is('resolved_at', null);

  const events = (eventsData || []) as unknown as { event_type: string; city: string; severity_score: number }[];
  const cityRisk: Record<string, { city: string; events: number; avgSeverity: number; totalSev: number }> = {};
  for (const e of events) {
    if (!cityRisk[e.city]) cityRisk[e.city] = { city: e.city, events: 0, avgSeverity: 0, totalSev: 0 };
    cityRisk[e.city].events++;
    cityRisk[e.city].totalSev += Number(e.severity_score);
  }
  for (const cr of Object.values(cityRisk)) {
    cr.avgSeverity = cr.events > 0 ? cr.totalSev / cr.events : 0;
  }
  const cityRiskList = Object.values(cityRisk).sort((a, b) => b.avgSeverity - a.avgSeverity);

  // Claims trend by event type + city
  const { data: claimsData } = await admin
    .from('parametric_claims')
    .select('disruption_event_id, live_disruption_events(event_type, city)')
    .order('created_at', { ascending: false })
    .limit(500);

  const claimRows = (claimsData || []) as unknown as {
    disruption_event_id: string;
    live_disruption_events: { event_type: string; city: string } | null;
  }[];

  const trendMap: Record<string, ClaimTrend> = {};
  for (const c of claimRows) {
    if (!c.live_disruption_events) continue;
    const key = `${c.live_disruption_events.event_type}-${c.live_disruption_events.city}`;
    if (!trendMap[key]) {
      trendMap[key] = {
        event_type: c.live_disruption_events.event_type,
        city: c.live_disruption_events.city,
        count: 0,
      };
    }
    trendMap[key].count++;
  }
  const trends = Object.values(trendMap).sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6">
      <h1 className="serif text-2xl font-bold">Analytics</h1>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--rule)' }}>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--rule)', background: 'var(--cream-d)' }}>
          <h2 className="font-medium" style={{ color: 'var(--ink)' }}>Per-City Risk (Active Events)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ color: 'var(--ink-60)', borderBottom: '1px solid var(--ink-10)' }}>
                <th className="px-4 py-3 font-medium">City</th>
                <th className="px-4 py-3 font-medium">Active Events</th>
                <th className="px-4 py-3 font-medium">Avg Severity</th>
              </tr>
            </thead>
            <tbody>
              {cityRiskList.map((cr) => (
                <tr key={cr.city} className="admin-row" style={{ borderTop: '1px solid var(--ink-10)' }}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--ink)' }}>{cr.city}</td>
                  <td className="serif px-4 py-3" style={{ color: 'var(--ink-60)' }}>{cr.events}</td>
                  <td className="serif px-4 py-3 font-medium" style={{ color: cr.avgSeverity >= 7 ? 'var(--red-acc)' : cr.avgSeverity >= 5 ? 'var(--ink-60)' : 'var(--teal)' }}>
                    {cr.avgSeverity.toFixed(1)}
                  </td>
                </tr>
              ))}
              {cityRiskList.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center" style={{ color: 'var(--ink-30)' }}>No active events</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--rule)' }}>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--rule)', background: 'var(--cream-d)' }}>
          <h2 className="font-medium" style={{ color: 'var(--ink)' }}>Claims Trend (by Event + City)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ color: 'var(--ink-60)', borderBottom: '1px solid var(--ink-10)' }}>
                <th className="px-4 py-3 font-medium">Event Type</th>
                <th className="px-4 py-3 font-medium">City</th>
                <th className="px-4 py-3 font-medium">Claims</th>
              </tr>
            </thead>
            <tbody>
              {trends.map((t) => {
                const triggerLabel = TRIGGERS[t.event_type as DisruptionType]?.label || t.event_type;
                return (
                  <tr key={`${t.event_type}-${t.city}`} className="admin-row" style={{ borderTop: '1px solid var(--ink-10)' }}>
                    <td className="px-4 py-3" style={{ color: 'var(--ink)' }}>{triggerLabel}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--ink-60)' }}>{t.city}</td>
                    <td className="serif px-4 py-3 font-medium">{t.count}</td>
                  </tr>
                );
              })}
              {trends.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center" style={{ color: 'var(--ink-30)' }}>No claims data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--rule)' }}>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--rule)', background: 'var(--cream-d)' }}>
          <h2 className="font-medium" style={{ color: 'var(--ink)' }}>Recent Premium Recommendations</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ color: 'var(--ink-60)', borderBottom: '1px solid var(--ink-10)' }}>
                <th className="px-4 py-3 font-medium">Week</th>
                <th className="px-4 py-3 font-medium">Base</th>
                <th className="px-4 py-3 font-medium">Weather</th>
                <th className="px-4 py-3 font-medium">UBI</th>
                <th className="px-4 py-3 font-medium">Final</th>
                <th className="px-4 py-3 font-medium">Reasoning</th>
              </tr>
            </thead>
            <tbody>
              {recommendations.map((rec) => (
                <tr key={rec.id} className="admin-row" style={{ borderTop: '1px solid var(--ink-10)' }}>
                  <td className="mono px-4 py-3" style={{ color: 'var(--ink)' }}>{rec.week_start_date}</td>
                  <td className="serif px-4 py-3" style={{ color: 'var(--ink-60)' }}>₹{Number(rec.base_premium)}</td>
                  <td className="serif px-4 py-3" style={{ color: 'var(--ink-60)' }}>₹{Number(rec.weather_risk)}</td>
                  <td className="serif px-4 py-3" style={{ color: 'var(--ink-60)' }}>₹{Number(rec.ubi_adjustment)}</td>
                  <td className="serif px-4 py-3 font-medium" style={{ color: 'var(--ink)' }}>₹{Number(rec.final_premium)}</td>
                  <td className="px-4 py-3 text-xs max-w-[300px] truncate" style={{ color: 'var(--ink-60)' }}>
                    {rec.reasoning || '-'}
                  </td>
                </tr>
              ))}
              {recommendations.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center" style={{ color: 'var(--ink-30)' }}>No recommendations yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
