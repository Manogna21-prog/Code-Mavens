import { createAdminClient } from '@/lib/supabase/admin';
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

interface DriverRow {
  id: string;
  full_name: string | null;
  phone_number: string | null;
  city: string | null;
  trust_score: number;
  onboarding_status: string;
  created_at: string;
}

export default async function AdminDriversPage() {
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

  const { data: driversData } = await admin
    .from('profiles')
    .select('id, full_name, phone_number, city, trust_score, onboarding_status, created_at')
    .eq('role', 'driver')
    .order('created_at', { ascending: false });

  const drivers = (driversData as unknown as DriverRow[]) || [];

  // Fetch claim counts per driver
  const driverIds = drivers.map((d) => d.id);
  const { data: claimsData } = driverIds.length > 0
    ? await admin
        .from('parametric_claims')
        .select('profile_id, payout_amount_inr')
        .in('profile_id', driverIds)
    : { data: [] };

  const claims = (claimsData || []) as unknown as { profile_id: string; payout_amount_inr: number }[];
  const claimsByDriver: Record<string, { count: number; total: number }> = {};
  for (const c of claims) {
    if (!claimsByDriver[c.profile_id]) claimsByDriver[c.profile_id] = { count: 0, total: 0 };
    claimsByDriver[c.profile_id].count++;
    claimsByDriver[c.profile_id].total += Number(c.payout_amount_inr);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="serif text-2xl font-bold">Drivers</h1>
        <div className="mono text-sm" style={{ color: 'var(--ink-60)' }}>{drivers.length} total</div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--rule)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ background: 'var(--cream-d)', color: 'var(--ink-60)' }}>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">City</th>
                <th className="px-4 py-3 font-medium">Trust</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Claims</th>
                <th className="px-4 py-3 font-medium">Payouts</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => {
                const stats = claimsByDriver[driver.id] || { count: 0, total: 0 };
                const trustStyle = driver.trust_score >= 0.7
                  ? { color: 'var(--teal)' }
                  : driver.trust_score >= 0.4
                    ? { color: 'var(--ink-60)' }
                    : { color: 'var(--red-acc)' };
                const statusComplete = driver.onboarding_status === 'complete';

                return (
                  <tr key={driver.id} className="admin-row" style={{ borderTop: '1px solid var(--ink-10)' }}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--ink)' }}>{driver.full_name || 'Unnamed'}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--ink-60)' }}>{driver.phone_number || '-'}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--ink-60)' }}>{driver.city || '-'}</td>
                    <td className="serif px-4 py-3 font-medium" style={trustStyle}>
                      {(driver.trust_score * 100).toFixed(0)}%
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="mono text-xs font-medium px-2 py-1 rounded-full"
                        style={
                          statusComplete
                            ? { border: '1px solid var(--teal)', color: 'var(--teal)' }
                            : { border: '1px solid var(--ink-60)', color: 'var(--ink-60)' }
                        }
                      >
                        {statusComplete ? 'Complete' : driver.onboarding_status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="serif px-4 py-3" style={{ color: 'var(--ink-60)' }}>{stats.count}</td>
                    <td className="serif px-4 py-3" style={{ color: 'var(--ink-60)' }}>₹{stats.total.toLocaleString()}</td>
                  </tr>
                );
              })}
              {drivers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center" style={{ color: 'var(--ink-30)' }}>
                    No drivers registered yet
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
