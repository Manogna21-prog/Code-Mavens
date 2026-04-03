'use client';

import { useState } from 'react';
import { PLAN_PACKAGES, type TierType } from '@/lib/config/constants';

interface PaymentStepProps {
  tier: TierType;
  city: string;
  onNext: () => void;
  onBack: () => void;
}

export default function PaymentStep({ tier, city, onNext, onBack }: PaymentStepProps) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const plan = PLAN_PACKAGES.find((p) => p.slug === tier);
  if (!plan) return null;

  const handlePay = async () => {
    setProcessing(true);
    setError('');

    try {
      // Create a demo policy via API
      const res = await fetch('/api/payments/simulate-payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_slug: tier }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Payment failed');
        setProcessing(false);
        return;
      }

      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
      setProcessing(false);
    }
  };

  return (
    <div>
      <h3 className="serif text-lg font-semibold mb-1" style={{ color: 'var(--ink)' }}>Payment</h3>
      <p className="sans text-sm mb-6" style={{ color: 'var(--ink-60)' }}>
        Review your plan and make your first weekly payment.
      </p>

      {/* Summary Card */}
      <div className="rounded-xl p-5 mb-6 space-y-3" style={{ background: 'var(--cream-d)' }}>
        <div className="flex justify-between">
          <span className="mono text-sm" style={{ color: 'var(--ink-60)' }}>Plan</span>
          <span className="sans text-sm font-semibold" style={{ color: 'var(--ink)' }}>{plan.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="mono text-sm" style={{ color: 'var(--ink-60)' }}>Tier</span>
          <span className="sans text-sm font-semibold capitalize" style={{ color: 'var(--ink)' }}>{plan.tier}</span>
        </div>
        <div className="flex justify-between">
          <span className="mono text-sm" style={{ color: 'var(--ink-60)' }}>City</span>
          <span className="sans text-sm font-semibold capitalize" style={{ color: 'var(--ink)' }}>{city}</span>
        </div>
        <div className="flex justify-between">
          <span className="mono text-sm" style={{ color: 'var(--ink-60)' }}>Max Weekly Payout</span>
          <span className="sans text-sm font-semibold" style={{ color: 'var(--ink)' }}>&#8377;{plan.max_weekly_payout_inr.toLocaleString('en-IN')}</span>
        </div>
        <hr style={{ borderColor: 'var(--rule)' }} />
        <div className="flex justify-between items-center">
          <span className="sans text-base font-semibold" style={{ color: 'var(--ink)' }}>Weekly Premium</span>
          <span className="serif text-xl font-bold" style={{ color: 'var(--teal)' }}>&#8377;{plan.weekly_premium_inr}</span>
        </div>
      </div>

      {/* Disruption Coverage */}
      <div className="mb-6">
        <h4 className="mono text-sm font-semibold mb-2" style={{ color: 'var(--ink-60)' }}>Coverage per Disruption</h4>
        <div className="space-y-2">
          {Object.entries(plan.payout_schedule).map(([event, amount]) => (
            <div key={event} className="flex justify-between text-sm px-3 py-2 rounded-lg" style={{ background: 'var(--cream)', border: '1px solid var(--rule)' }}>
              <span className="sans capitalize" style={{ color: 'var(--ink-60)' }}>{event.replace(/_/g, ' ')}</span>
              <span className="mono font-medium" style={{ color: 'var(--ink)' }}>&#8377;{amount}</span>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm mb-3" style={{ color: 'var(--red-acc)' }}>{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={processing}
          className="flex-1 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
          style={{ border: '1px solid var(--rule)', color: 'var(--ink-60)', background: 'transparent' }}
        >
          Back
        </button>
        <button
          type="button"
          onClick={handlePay}
          disabled={processing}
          className="flex-1 py-3 rounded-lg font-medium transition-colors disabled:opacity-70"
          style={{ background: 'var(--teal)', color: '#fff' }}
        >
          {processing ? 'Processing...' : `Pay \u20B9${plan.weekly_premium_inr}`}
        </button>
      </div>

      <p className="mono text-xs text-center mt-4" style={{ color: 'var(--ink-30)' }}>
        Demo mode — no real payment charged.
      </p>
    </div>
  );
}
