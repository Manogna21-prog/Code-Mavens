import { createAdminClient } from '@/lib/supabase/admin';
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

interface SystemLogRow {
  id: string;
  event_type: string;
  severity: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface TriggerLedgerRow {
  id: string;
  event_type: string | null;
  city: string | null;
  trigger_value: number | null;
  outcome: string | null;
  claims_created: number;
  payouts_initiated: number;
  error_message: string | null;
  latency_ms: number | null;
  created_at: string;
}

const SEVERITY_STYLES: Record<string, { border: string; color: string }> = {
  info: { border: '1px solid var(--teal)', color: 'var(--teal)' },
  warning: { border: '1px solid var(--ink-60)', color: 'var(--ink-60)' },
  error: { border: '1px solid var(--red-acc)', color: 'var(--red-acc)' },
};

const OUTCOME_STYLES: Record<string, { border: string; color: string }> = {
  triggered: { border: '1px solid var(--teal)', color: 'var(--teal)' },
  no_pay: { border: '1px solid var(--ink-60)', color: 'var(--ink-60)' },
  deferred: { border: '1px solid var(--ink-60)', color: 'var(--ink-60)' },
  error: { border: '1px solid var(--red-acc)', color: 'var(--red-acc)' },
};

export default async function AdminHealthPage() {
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

  const { data: logsData } = await admin
    .from('system_logs')
    .select('id, event_type, severity, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  const logs = (logsData as unknown as SystemLogRow[]) || [];

  const { data: ledgerData } = await admin
    .from('parametric_trigger_ledger')
    .select('id, event_type, city, trigger_value, outcome, claims_created, payouts_initiated, error_message, latency_ms, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  const ledger = (ledgerData as unknown as TriggerLedgerRow[]) || [];

  // Simple health indicators
  const recentErrors = logs.filter((l) => l.severity === 'error').length;
  const recentTriggerErrors = ledger.filter((l) => l.outcome === 'error').length;

  return (
    <div className="space-y-6">
      <h1 className="serif text-2xl font-bold">System Health</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl p-4" style={{ border: '1px solid var(--rule)' }}>
          <div className="mono text-xs uppercase tracking-wide" style={{ color: 'var(--ink-60)' }}>API Status</div>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-3 h-3 rounded-full" style={{ background: 'var(--teal)' }} />
            <span className="font-medium" style={{ color: 'var(--teal)' }}>Operational</span>
          </div>
        </div>
        <div className="rounded-xl p-4" style={{ border: '1px solid var(--rule)' }}>
          <div className="mono text-xs uppercase tracking-wide" style={{ color: 'var(--ink-60)' }}>Recent Errors</div>
          <div className="serif text-2xl font-bold mt-1" style={{ color: recentErrors > 0 ? 'var(--red-acc)' : 'var(--teal)' }}>
            {recentErrors}
          </div>
        </div>
        <div className="rounded-xl p-4" style={{ border: '1px solid var(--rule)' }}>
          <div className="mono text-xs uppercase tracking-wide" style={{ color: 'var(--ink-60)' }}>Trigger Errors</div>
          <div className="serif text-2xl font-bold mt-1" style={{ color: recentTriggerErrors > 0 ? 'var(--red-acc)' : 'var(--teal)' }}>
            {recentTriggerErrors}
          </div>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--rule)' }}>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--rule)', background: 'var(--cream-d)' }}>
          <h2 className="font-medium" style={{ color: 'var(--ink)' }}>System Logs (Last 20)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ color: 'var(--ink-60)', borderBottom: '1px solid var(--ink-10)' }}>
                <th className="px-4 py-3 font-medium">Severity</th>
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Metadata</th>
                <th className="px-4 py-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const sevStyle = SEVERITY_STYLES[log.severity] || { border: '1px solid var(--ink-60)', color: 'var(--ink-60)' };
                const time = new Date(log.created_at).toLocaleString('en-IN', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit',
                });
                return (
                  <tr key={log.id} className="admin-row" style={{ borderTop: '1px solid var(--ink-10)' }}>
                    <td className="px-4 py-3">
                      <span className="mono text-xs font-medium px-2 py-1 rounded-full" style={sevStyle}>
                        {log.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--ink)' }}>{log.event_type}</td>
                    <td className="mono px-4 py-3 text-xs max-w-[300px] truncate" style={{ color: 'var(--ink-60)' }}>
                      {JSON.stringify(log.metadata)}
                    </td>
                    <td className="mono px-4 py-3 text-xs" style={{ color: 'var(--ink-60)' }}>{time}</td>
                  </tr>
                );
              })}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center" style={{ color: 'var(--ink-30)' }}>No system logs</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--rule)' }}>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--rule)', background: 'var(--cream-d)' }}>
          <h2 className="font-medium" style={{ color: 'var(--ink)' }}>Trigger Ledger (Last 20)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ color: 'var(--ink-60)', borderBottom: '1px solid var(--ink-10)' }}>
                <th className="px-4 py-3 font-medium">Event Type</th>
                <th className="px-4 py-3 font-medium">City</th>
                <th className="px-4 py-3 font-medium">Value</th>
                <th className="px-4 py-3 font-medium">Outcome</th>
                <th className="px-4 py-3 font-medium">Claims</th>
                <th className="px-4 py-3 font-medium">Latency</th>
                <th className="px-4 py-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((entry) => {
                const outcomeStyle = OUTCOME_STYLES[entry.outcome || ''] || { border: '1px solid var(--ink-60)', color: 'var(--ink-60)' };
                const time = new Date(entry.created_at).toLocaleString('en-IN', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                });
                return (
                  <tr key={entry.id} className="admin-row" style={{ borderTop: '1px solid var(--ink-10)' }}>
                    <td className="px-4 py-3" style={{ color: 'var(--ink)' }}>{entry.event_type || '-'}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--ink-60)' }}>{entry.city || '-'}</td>
                    <td className="serif px-4 py-3" style={{ color: 'var(--ink-60)' }}>{entry.trigger_value ?? '-'}</td>
                    <td className="px-4 py-3">
                      <span className="mono text-xs font-medium px-2 py-1 rounded-full" style={outcomeStyle}>
                        {entry.outcome || '-'}
                      </span>
                    </td>
                    <td className="serif px-4 py-3" style={{ color: 'var(--ink-60)' }}>{entry.claims_created}</td>
                    <td className="mono px-4 py-3" style={{ color: 'var(--ink-60)' }}>
                      {entry.latency_ms ? `${entry.latency_ms}ms` : '-'}
                    </td>
                    <td className="mono px-4 py-3 text-xs" style={{ color: 'var(--ink-60)' }}>{time}</td>
                  </tr>
                );
              })}
              {ledger.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center" style={{ color: 'var(--ink-30)' }}>No trigger ledger entries</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
