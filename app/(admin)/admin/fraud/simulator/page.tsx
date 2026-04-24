'use client';

import { useMemo, useState } from 'react';
import { computeFraudScore, type FraudSignalsInput } from '@/lib/fraud/scoring';
import { FRAUD } from '@/lib/config/constants';

// Keep these labels in plain English — the simulator's whole purpose is to let
// non-technical stakeholders poke the inputs and see the score change.
const SIGNAL_META: Record<
  string,
  { label: string; weight: number; blurb: string }
> = {
  trust_history: {
    label: 'Prior history & trust',
    weight: 0.40,
    blurb: 'Past flagged claims, confirmed fraud, how long the account has been clean.',
  },
  location_anomaly: {
    label: 'Location integrity',
    weight: 0.35,
    blurb: 'Does the phone’s GPS agree with the network IP? Any impossible travel?',
  },
  cluster: {
    label: 'Ring / cluster',
    weight: 0.25,
    blurb: 'Many accounts claiming the same event from shared devices, IPs, or a single GPS spot.',
  },
};

interface Contribution {
  signal: keyof typeof SIGNAL_META;
  triggered: boolean;
  severity: number;
  weight: number;
  contribution: number;
  reason: string;
  detail: Record<string, unknown>;
}

interface SimResponse {
  score: number;
  decision: 'auto_approve' | 'flag' | 'manual_review';
  contributions: Contribution[];
  thresholds: { auto_approve: number; manual_review: number };
}

type Profile = 'clean' | 'spoof' | 'ring' | 'mixed';

function profileToInput(p: Profile) {
  switch (p) {
    case 'clean':
      return {
        trust_history: { trustScore: 0.85, priorFlaggedCount: 0, confirmedFraudCount: 0, tenureMonths: 14 },
        location_anomaly: { gpsToIpDistanceKm: 3, impossibleTravel: false },
        cluster: { claimCountInWindow: 4, uniqueDevices: 4, sharedIpsAcrossProfiles: 0, lowGpsEntropy: false },
      };
    case 'spoof':
      return {
        trust_history: { trustScore: 0.45, priorFlaggedCount: 1, confirmedFraudCount: 0, tenureMonths: 2 },
        location_anomaly: { gpsToIpDistanceKm: 180, impossibleTravel: true },
        cluster: { claimCountInWindow: 2, uniqueDevices: 2, sharedIpsAcrossProfiles: 0, lowGpsEntropy: false },
      };
    case 'ring':
      return {
        trust_history: { trustScore: 0.5, priorFlaggedCount: 0, confirmedFraudCount: 0, tenureMonths: 1 },
        location_anomaly: { gpsToIpDistanceKm: 8, impossibleTravel: false },
        cluster: { claimCountInWindow: 25, uniqueDevices: 6, sharedIpsAcrossProfiles: 3, lowGpsEntropy: true },
      };
    case 'mixed':
    default:
      return {
        trust_history: { trustScore: 0.4, priorFlaggedCount: 2, confirmedFraudCount: 1, tenureMonths: 4 },
        location_anomaly: { gpsToIpDistanceKm: 70, impossibleTravel: false },
        cluster: { claimCountInWindow: 12, uniqueDevices: 5, sharedIpsAcrossProfiles: 1, lowGpsEntropy: false },
      };
  }
}

export default function FraudSimulatorPage() {
  const [profile, setProfile] = useState<Profile>('mixed');
  const [input, setInput] = useState(() => profileToInput('mixed'));

  // The scoring is pure math — no DB, no network. Compute it synchronously
  // on every render so the UI updates instantly as the admin drags sliders.
  const result = useMemo<SimResponse>(() => {
    const r = computeFraudScore(input as FraudSignalsInput);
    return {
      score: r.score,
      decision: r.decision,
      contributions: r.contributions as Contribution[],
      thresholds: {
        auto_approve: FRAUD.AUTO_APPROVE_THRESHOLD,
        manual_review: FRAUD.MANUAL_REVIEW_THRESHOLD,
      },
    };
  }, [input]);

  function applyProfile(p: Profile) {
    setProfile(p);
    setInput(profileToInput(p));
  }

  const decisionColor = useMemo(() => {
    if (result.decision === 'manual_review') return 'var(--red-acc)';
    if (result.decision === 'flag') return '#b07a00';
    return 'var(--teal)';
  }, [result]);

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <h1 className="serif text-2xl font-bold">Fraud Simulator</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--ink-60)' }}>
          Play with each signal and see how the model scores it. All three signals below are
          things a driver or fraud ring can actually control. System-only issues (duplicate
          claims, rapid-fire adjudication, weather-API mismatch) are not fraud — they are
          backend-health checks surfaced elsewhere.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <span className="mono text-xs self-center mr-2" style={{ color: 'var(--ink-60)' }}>
          Preset scenarios:
        </span>
        {(['clean', 'spoof', 'ring', 'mixed'] as Profile[]).map((p) => (
          <button
            key={p}
            onClick={() => applyProfile(p)}
            className="mono text-xs px-3 py-1.5 rounded-full"
            style={{
              border: '1px solid var(--rule)',
              background: profile === p ? 'var(--teal-bg)' : 'transparent',
              color: profile === p ? 'var(--teal)' : 'var(--ink-60)',
            }}
          >
            {presetLabel(p)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(280px,340px)] gap-6">
        <div className="space-y-4">
          <SignalCard
            title={SIGNAL_META.trust_history.label}
            weight={SIGNAL_META.trust_history.weight}
            blurb={SIGNAL_META.trust_history.blurb}
            contribution={result?.contributions.find((c) => c.signal === 'trust_history')}
          >
            <NumberRow label="Trust score (0–1)" min={0} max={1} step={0.05}
              value={input.trust_history.trustScore}
              onChange={(v) => setInput({ ...input, trust_history: { ...input.trust_history, trustScore: v } })} />
            <NumberRow label="Prior flagged claims" min={0} max={20} step={1}
              value={input.trust_history.priorFlaggedCount}
              onChange={(v) => setInput({ ...input, trust_history: { ...input.trust_history, priorFlaggedCount: v } })} />
            <NumberRow label="Confirmed fraud" min={0} max={10} step={1}
              value={input.trust_history.confirmedFraudCount}
              onChange={(v) => setInput({ ...input, trust_history: { ...input.trust_history, confirmedFraudCount: v } })} />
            <NumberRow label="Tenure (months)" min={0} max={48} step={1}
              value={input.trust_history.tenureMonths}
              onChange={(v) => setInput({ ...input, trust_history: { ...input.trust_history, tenureMonths: v } })} />
          </SignalCard>

          <SignalCard
            title={SIGNAL_META.location_anomaly.label}
            weight={SIGNAL_META.location_anomaly.weight}
            blurb={SIGNAL_META.location_anomaly.blurb}
            contribution={result?.contributions.find((c) => c.signal === 'location_anomaly')}
          >
            <p className="text-xs mb-2" style={{ color: 'var(--ink-60)' }}>
              GPS comes from the phone’s satellite chip. IP comes from whatever network the
              request arrives on, looked up server-side. They’re independent data sources,
              so a mismatch means the phone is claiming to be somewhere it isn’t.
            </p>
            <NumberRow label="GPS ↔ IP distance (km)" min={0} max={500} step={1}
              value={input.location_anomaly.gpsToIpDistanceKm ?? 0}
              onChange={(v) => setInput({ ...input, location_anomaly: { ...input.location_anomaly, gpsToIpDistanceKm: v } })} />
            <BoolRow label="Impossible travel (>50km in <30min)"
              value={input.location_anomaly.impossibleTravel}
              onChange={(v) => setInput({ ...input, location_anomaly: { ...input.location_anomaly, impossibleTravel: v } })} />
          </SignalCard>

          <SignalCard
            title={SIGNAL_META.cluster.label}
            weight={SIGNAL_META.cluster.weight}
            blurb={SIGNAL_META.cluster.blurb}
            contribution={result?.contributions.find((c) => c.signal === 'cluster')}
          >
            <NumberRow label="Claims on this event in 10min" min={0} max={100} step={1}
              value={input.cluster.claimCountInWindow}
              onChange={(v) => setInput({ ...input, cluster: { ...input.cluster, claimCountInWindow: v } })} />
            <NumberRow label="Unique devices among those claims" min={0} max={100} step={1}
              value={input.cluster.uniqueDevices}
              onChange={(v) => setInput({ ...input, cluster: { ...input.cluster, uniqueDevices: v } })} />
            <NumberRow label="Shared IPs across profiles" min={0} max={20} step={1}
              value={input.cluster.sharedIpsAcrossProfiles}
              onChange={(v) => setInput({ ...input, cluster: { ...input.cluster, sharedIpsAcrossProfiles: v } })} />
            <BoolRow label="Low GPS entropy (everyone at same spot)"
              value={input.cluster.lowGpsEntropy}
              onChange={(v) => setInput({ ...input, cluster: { ...input.cluster, lowGpsEntropy: v } })} />
          </SignalCard>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 self-start">
          <div
            className="rounded-xl p-5"
            style={{ border: `2px solid ${decisionColor}`, background: 'var(--cream-d)' }}
          >
            <div className="mono text-xs uppercase" style={{ color: 'var(--ink-60)' }}>
              Fraud score
            </div>
            <div className="serif text-5xl font-bold my-1" style={{ color: decisionColor }}>
              {result ? (result.score * 100).toFixed(0) : '—'}%
            </div>
            <div className="mono text-sm font-medium" style={{ color: decisionColor }}>
              {result ? decisionLabel(result.decision) : ''}
            </div>

            {result && (
              <>
                <div className="mt-4 h-2 rounded-full overflow-hidden" style={{ background: 'var(--ink-10)' }}>
                  <div
                    className="h-full"
                    style={{
                      width: `${result.score * 100}%`,
                      background: decisionColor,
                      transition: 'width 200ms ease',
                    }}
                  />
                </div>
                <div className="flex justify-between mono text-xs mt-1" style={{ color: 'var(--ink-30)' }}>
                  <span>0</span>
                  <span style={{ color: 'var(--teal)' }}>auto-pay &lt; {Math.round(result.thresholds.auto_approve * 100)}</span>
                  <span style={{ color: 'var(--red-acc)' }}>review ≥ {Math.round(result.thresholds.manual_review * 100)}</span>
                  <span>100</span>
                </div>
              </>
            )}
          </div>

          {result && (
            <div className="rounded-xl p-4 space-y-2" style={{ border: '1px solid var(--rule)' }}>
              <div className="mono text-xs uppercase mb-2" style={{ color: 'var(--ink-60)' }}>
                Score breakdown
              </div>
              {result.contributions.map((c) => (
                <div key={c.signal} className="flex items-center justify-between text-sm">
                  <div className="flex-1 truncate">
                    <div className="font-medium">{SIGNAL_META[c.signal].label}</div>
                    <div className="mono text-xs" style={{ color: 'var(--ink-30)' }}>
                      severity {(c.severity * 100).toFixed(0)}% × weight {Math.round(c.weight * 100)}%
                    </div>
                  </div>
                  <div className="serif font-bold" style={{ color: c.triggered ? 'var(--red-acc)' : 'var(--ink-30)' }}>
                    +{(c.contribution * 100).toFixed(0)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function SignalCard(props: {
  title: string;
  weight: number;
  blurb: string;
  contribution?: Contribution;
  children: React.ReactNode;
}) {
  const { title, weight, blurb, contribution, children } = props;
  const active = contribution?.triggered ?? false;

  return (
    <section
      className="rounded-xl p-5"
      style={{ border: `1px solid ${active ? 'var(--red-acc)' : 'var(--rule)'}` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="serif text-lg font-bold">{title}</h2>
          <p className="text-xs" style={{ color: 'var(--ink-60)' }}>{blurb}</p>
        </div>
        <span className="mono text-xs px-2 py-0.5 rounded-full whitespace-nowrap"
          style={{ border: '1px solid var(--rule)', color: 'var(--ink-60)' }}>
          weight {Math.round(weight * 100)}%
        </span>
      </div>
      <div className="space-y-2">{children}</div>
      {contribution && (
        <div className="mt-3 text-xs" style={{ color: active ? 'var(--red-acc)' : 'var(--ink-30)' }}>
          {contribution.reason}
        </div>
      )}
    </section>
  );
}

function NumberRow({ label, value, onChange, min, max, step }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number;
}) {
  return (
    <label className="block">
      <div className="flex justify-between text-xs mb-1">
        <span style={{ color: 'var(--ink-60)' }}>{label}</span>
        <span className="mono" style={{ color: 'var(--ink)' }}>{value}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </label>
  );
}

function BoolRow({ label, value, onChange }: {
  label: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span style={{ color: 'var(--ink-60)' }}>{label}</span>
    </label>
  );
}

function presetLabel(p: Profile): string {
  switch (p) {
    case 'clean': return 'Honest driver';
    case 'spoof': return 'GPS spoof';
    case 'ring': return 'Fraud ring';
    case 'mixed': return 'Mixed signals';
  }
}

function decisionLabel(d: SimResponse['decision']): string {
  switch (d) {
    case 'auto_approve': return 'Auto-approve → pay instantly';
    case 'flag': return 'Approve but flag for monitoring';
    case 'manual_review': return 'Send to manual review';
  }
}
