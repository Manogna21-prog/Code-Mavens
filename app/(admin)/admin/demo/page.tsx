'use client';

import { useState } from 'react';
import { CITIES } from '@/lib/config/cities';
import { DISRUPTION_TYPES, TRIGGERS } from '@/lib/config/constants';
import type { DisruptionType } from '@/lib/config/constants';

interface TriggerResult {
  status: string;
  event_id?: string;
  message?: string;
  error?: string;
}

export default function AdminDemoPage() {
  const [city, setCity] = useState(CITIES[0].slug);
  const [eventType, setEventType] = useState<DisruptionType>(DISRUPTION_TYPES[0]);
  const [severity, setSeverity] = useState(7);
  const [triggerValue, setTriggerValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TriggerResult | null>(null);

  const triggerConfig = TRIGGERS[eventType];

  async function handleFire() {
    setLoading(true);
    setResult(null);
    try {
      const body: Record<string, unknown> = {
        city,
        event_type: eventType,
        severity,
      };
      if (triggerValue) {
        body.trigger_value = Number(triggerValue);
      }

      const res = await fetch('/api/admin/demo-trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as TriggerResult;
      setResult(data);
    } catch (err) {
      setResult({ status: 'error', error: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="serif text-2xl font-bold">Demo Trigger Panel</h1>
      <p className="text-sm" style={{ color: 'var(--ink-60)' }}>Inject synthetic disruption events for testing.</p>

      <div className="rounded-xl p-6 space-y-5" style={{ border: '1px solid var(--rule)' }}>
        <div>
          <label className="mono block text-sm font-medium mb-1" style={{ color: 'var(--ink)' }}>City</label>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ border: '1px solid var(--rule)' }}
          >
            {CITIES.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name} ({c.state})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mono block text-sm font-medium mb-1" style={{ color: 'var(--ink)' }}>Disruption Type</label>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value as DisruptionType)}
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ border: '1px solid var(--rule)' }}
          >
            {DISRUPTION_TYPES.map((dt) => (
              <option key={dt} value={dt}>{TRIGGERS[dt].label}</option>
            ))}
          </select>
          <p className="text-xs mt-1" style={{ color: 'var(--ink-30)' }}>{triggerConfig.description}</p>
        </div>

        <div>
          <label className="mono block text-sm font-medium mb-1" style={{ color: 'var(--ink)' }}>
            Severity: {severity.toFixed(1)}
          </label>
          <input
            type="range"
            min={0}
            max={10}
            step={0.1}
            value={severity}
            onChange={(e) => setSeverity(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs" style={{ color: 'var(--ink-30)' }}>
            <span>0</span>
            <span>5</span>
            <span>10</span>
          </div>
        </div>

        <div>
          <label className="mono block text-sm font-medium mb-1" style={{ color: 'var(--ink)' }}>
            Trigger Value ({triggerConfig.unit})
          </label>
          <input
            type="number"
            value={triggerValue}
            onChange={(e) => setTriggerValue(e.target.value)}
            placeholder={`Threshold: ${triggerConfig.threshold}`}
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ border: '1px solid var(--rule)' }}
          />
          <p className="text-xs mt-1" style={{ color: 'var(--ink-30)' }}>
            Leave empty for default ({triggerConfig.threshold * 1.5} {triggerConfig.unit})
          </p>
        </div>

        <button
          onClick={handleFire}
          disabled={loading}
          className="w-full text-white font-medium py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{ background: 'var(--red-acc)' }}
        >
          {loading ? 'Firing...' : 'Fire Trigger'}
        </button>
      </div>

      {result && (
        <div
          className="rounded-xl p-4"
          style={
            result.error
              ? { background: 'rgba(192,57,43,0.06)', border: '1px solid var(--red-acc)' }
              : { background: 'var(--teal-bg)', border: '1px solid var(--teal)' }
          }
        >
          {result.error ? (
            <div style={{ color: 'var(--red-acc)' }}>
              <div className="font-medium">Error</div>
              <div className="text-sm">{result.error}</div>
            </div>
          ) : (
            <div style={{ color: 'var(--teal)' }}>
              <div className="font-medium">Trigger Fired</div>
              <div className="text-sm">{result.message}</div>
              {result.event_id && (
                <div className="mono text-xs mt-1" style={{ color: 'var(--teal-d)' }}>Event ID: {result.event_id}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
