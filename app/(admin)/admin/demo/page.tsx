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
  const [fireHover, setFireHover] = useState(false);

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
      <style>{`
        @keyframes riskSlideIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .risk-slide { animation: riskSlideIn 0.5s ease both; }
        .risk-slide-1 { animation-delay: 0.05s; }
        .risk-slide-2 { animation-delay: 0.1s; }
        .risk-slide-3 { animation-delay: 0.15s; }
        .risk-slide-4 { animation-delay: 0.2s; }
        .risk-slide-5 { animation-delay: 0.25s; }
        @keyframes firePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.4); }
          50% { box-shadow: 0 0 0 10px rgba(220,38,38,0); }
        }
        .fire-btn-hover {
          animation: firePulse 1.5s ease infinite;
        }
      `}</style>

      <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1A1A1A', letterSpacing: '-0.03em', fontFamily: "var(--font-inter),'Inter',sans-serif" }}>Demo Trigger Panel</h1>

      {/* Form Card */}
      <div className="risk-slide risk-slide-2 p-6 space-y-5" style={{
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        border: '1px solid rgba(249,115,22,0.12)',
        transition: 'box-shadow 0.2s ease',
      }}
      onMouseOver={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 32px rgba(99,102,241,0.08)'; }}
      onMouseOut={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; }}
      >
        <div>
          <label className="mono block text-sm font-medium mb-1" style={{ color: '#1A1A1A' }}>City</label>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ border: '1px solid #E8E8EA' }}
          >
            {CITIES.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name} ({c.state})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mono block text-sm font-medium mb-1" style={{ color: '#1A1A1A' }}>Disruption Type</label>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value as DisruptionType)}
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ border: '1px solid #E8E8EA' }}
          >
            {DISRUPTION_TYPES.map((dt) => (
              <option key={dt} value={dt}>{TRIGGERS[dt].label}</option>
            ))}
          </select>
          <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>{triggerConfig.description}</p>
        </div>

        <div>
          <label className="mono block text-sm font-medium mb-1" style={{ color: '#1A1A1A' }}>
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
          <div className="flex justify-between text-xs" style={{ color: '#9CA3AF' }}>
            <span>0</span>
            <span>5</span>
            <span>10</span>
          </div>
        </div>

        <div>
          <label className="mono block text-sm font-medium mb-1" style={{ color: '#1A1A1A' }}>
            Trigger Value ({triggerConfig.unit})
          </label>
          <input
            type="number"
            value={triggerValue}
            onChange={(e) => setTriggerValue(e.target.value)}
            placeholder={`Threshold: ${triggerConfig.threshold}`}
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ border: '1px solid #E8E8EA' }}
          />
          <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
            Leave empty for default ({triggerConfig.threshold * 1.5} {triggerConfig.unit})
          </p>
        </div>

        <button
          onClick={handleFire}
          disabled={loading}
          className={`w-full text-white font-medium py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${fireHover && !loading ? 'fire-btn-hover' : ''}`}
          style={{ background: 'linear-gradient(135deg, #dc2626, #F97316)', boxShadow: fireHover ? '0 8px 24px rgba(220,38,38,0.3)' : 'none', transition: 'box-shadow 0.2s ease' }}
          onMouseOver={() => setFireHover(true)}
          onMouseOut={() => setFireHover(false)}
        >
          {loading ? 'Firing...' : 'Fire Trigger'}
        </button>
      </div>

      {result && (
        <div
          className="risk-slide risk-slide-3 rounded-xl p-4"
          style={
            result.error
              ? { background: 'linear-gradient(135deg, rgba(220,38,38,0.08), rgba(236,72,153,0.06))', border: '1px solid #dc2626' }
              : { background: 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(20,184,166,0.06))', border: '1px solid #22C55E' }
          }
        >
          {result.error ? (
            <div style={{ color: '#dc2626' }}>
              <div className="font-medium">Error</div>
              <div className="text-sm">{result.error}</div>
            </div>
          ) : (
            <div style={{ color: '#22C55E' }}>
              <div className="font-medium">Trigger Fired</div>
              <div className="text-sm">{result.message}</div>
              {result.event_id && (
                <div className="mono text-xs mt-1" style={{ color: '#16a34a' }}>Event ID: {result.event_id}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
