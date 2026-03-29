import { createAdminClient } from '@/lib/supabase/admin';
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { FinancialChart } from './chart';

interface CityBreakdown {
  city: string;
  premium_total: number;
  payout_total: number;
  claim_count: number;
}

export default async function AdminFinancialPage() {
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

  // Total premium revenue
  const { data: policiesData } = await admin
    .from('weekly_policies')
    .select('final_premium_inr, week_start_date, profile_id');
  const policies = (policiesData || []) as unknown as { final_premium_inr: number; week_start_date: string; profile_id: string }[];
  const totalPremium = policies.reduce((sum, p) => sum + Number(p.final_premium_inr), 0);

  // Total payouts
  const { data: payoutsData } = await admin
    .from('payout_ledger')
    .select('amount_inr, created_at');
  const payouts = (payoutsData || []) as unknown as { amount_inr: number; created_at: string }[];
  const totalPayouts = payouts.reduce((sum, p) => sum + Number(p.amount_inr), 0);

  const lossRatio = totalPremium > 0 ? (totalPayouts / totalPremium * 100).toFixed(1) : '0.0';

  // Per-city breakdown
  const { data: profilesData } = await admin
    .from('profiles')
    .select('id, city')
    .eq('role', 'driver');
  const profiles = (profilesData || []) as unknown as { id: string; city: string | null }[];
  const cityByProfile: Record<string, string> = {};
  for (const p of profiles) {
    if (p.city) cityByProfile[p.id] = p.city;
  }

  const { data: claimsData } = await admin
    .from('parametric_claims')
    .select('profile_id, payout_amount_inr');
  const claims = (claimsData || []) as unknown as { profile_id: string; payout_amount_inr: number }[];

  const cityMap: Record<string, CityBreakdown> = {};
  for (const p of policies) {
    const city = cityByProfile[p.profile_id] || 'Unknown';
    if (!cityMap[city]) cityMap[city] = { city, premium_total: 0, payout_total: 0, claim_count: 0 };
    cityMap[city].premium_total += Number(p.final_premium_inr);
  }
  for (const c of claims) {
    const city = cityByProfile[c.profile_id] || 'Unknown';
    if (!cityMap[city]) cityMap[city] = { city, premium_total: 0, payout_total: 0, claim_count: 0 };
    cityMap[city].payout_total += Number(c.payout_amount_inr);
    cityMap[city].claim_count++;
  }
  const cityBreakdown = Object.values(cityMap).sort((a, b) => b.premium_total - a.premium_total);

  // Weekly chart data
  const weeklyMap: Record<string, { week: string; premium: number; payouts: number }> = {};
  for (const p of policies) {
    const week = p.week_start_date;
    if (!weeklyMap[week]) weeklyMap[week] = { week, premium: 0, payouts: 0 };
    weeklyMap[week].premium += Number(p.final_premium_inr);
  }
  for (const p of payouts) {
    const week = p.created_at.slice(0, 10);
    // Find closest week
    const weeks = Object.keys(weeklyMap);
    const closest = weeks.reduce((best, w) => {
      return Math.abs(new Date(w).getTime() - new Date(week).getTime()) <
        Math.abs(new Date(best).getTime() - new Date(week).getTime()) ? w : best;
    }, weeks[0] || week);
    if (!weeklyMap[closest]) weeklyMap[closest] = { week: closest, premium: 0, payouts: 0 };
    weeklyMap[closest].payouts += Number(p.amount_inr);
  }
  const chartData = Object.values(weeklyMap).sort((a, b) => a.week.localeCompare(b.week));

  return (
    <div className="space-y-6">
      <h1 className="serif text-2xl font-bold">Financial Overview</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl p-4" style={{ border: '1px solid var(--rule)' }}>
          <div className="mono text-xs uppercase tracking-wide" style={{ color: 'var(--ink-60)' }}>Total Premium Revenue</div>
          <div className="serif text-2xl font-bold mt-1" style={{ color: 'var(--teal)' }}>₹{totalPremium.toLocaleString()}</div>
        </div>
        <div className="rounded-xl p-4" style={{ border: '1px solid var(--rule)' }}>
          <div className="mono text-xs uppercase tracking-wide" style={{ color: 'var(--ink-60)' }}>Total Payouts</div>
          <div className="serif text-2xl font-bold mt-1" style={{ color: 'var(--red-acc)' }}>₹{totalPayouts.toLocaleString()}</div>
        </div>
        <div className="rounded-xl p-4" style={{ border: '1px solid var(--rule)' }}>
          <div className="mono text-xs uppercase tracking-wide" style={{ color: 'var(--ink-60)' }}>Loss Ratio</div>
          <div className="serif text-2xl font-bold mt-1" style={{ color: Number(lossRatio) > 80 ? 'var(--red-acc)' : 'var(--teal)' }}>
            {lossRatio}%
          </div>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="rounded-xl p-4" style={{ border: '1px solid var(--rule)' }}>
          <h2 className="font-medium mb-4" style={{ color: 'var(--ink)' }}>Premium vs Payouts by Week</h2>
          <FinancialChart data={chartData} />
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--rule)' }}>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--rule)', background: 'var(--cream-d)' }}>
          <h2 className="font-medium" style={{ color: 'var(--ink)' }}>Per-City Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ color: 'var(--ink-60)', borderBottom: '1px solid var(--ink-10)' }}>
                <th className="px-4 py-3 font-medium">City</th>
                <th className="px-4 py-3 font-medium">Premiums</th>
                <th className="px-4 py-3 font-medium">Payouts</th>
                <th className="px-4 py-3 font-medium">Claims</th>
                <th className="px-4 py-3 font-medium">Loss Ratio</th>
              </tr>
            </thead>
            <tbody>
              {cityBreakdown.map((row) => {
                const cityLoss = row.premium_total > 0
                  ? (row.payout_total / row.premium_total * 100).toFixed(1)
                  : '0.0';
                return (
                  <tr key={row.city} className="admin-row" style={{ borderTop: '1px solid var(--ink-10)' }}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--ink)' }}>{row.city}</td>
                    <td className="serif px-4 py-3" style={{ color: 'var(--teal)' }}>₹{row.premium_total.toLocaleString()}</td>
                    <td className="serif px-4 py-3" style={{ color: 'var(--red-acc)' }}>₹{row.payout_total.toLocaleString()}</td>
                    <td className="serif px-4 py-3" style={{ color: 'var(--ink-60)' }}>{row.claim_count}</td>
                    <td className="serif px-4 py-3 font-medium" style={{ color: Number(cityLoss) > 80 ? 'var(--red-acc)' : 'var(--teal)' }}>
                      {cityLoss}%
                    </td>
                  </tr>
                );
              })}
              {cityBreakdown.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center" style={{ color: 'var(--ink-30)' }}>
                    No financial data yet
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
