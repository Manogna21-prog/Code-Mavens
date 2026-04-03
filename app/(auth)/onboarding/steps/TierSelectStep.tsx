'use client';

import { useState } from 'react';
import { PLAN_PACKAGES, type TierType } from '@/lib/config/constants';

interface TierSelectStepProps {
  initialTier: TierType | '';
  onNext: (tier: TierType) => void;
  onBack: () => void;
}

export default function TierSelectStep({ initialTier, onNext, onBack }: TierSelectStepProps) {
  const [selected, setSelected] = useState<TierType | ''>(initialTier);

  return (
    <div>
      <h3 className="serif text-lg font-semibold mb-1" style={{ color: 'var(--ink)' }}>Choose Your Plan</h3>
      <p className="sans text-sm mb-6" style={{ color: 'var(--ink-60)' }}>
        Select a weekly insurance plan that fits your needs.
      </p>

      <div className="space-y-4">
        {PLAN_PACKAGES.map((plan) => {
          const isSelected = selected === plan.slug;

          return (
            <button
              key={plan.slug}
              type="button"
              onClick={() => setSelected(plan.slug)}
              className="w-full text-left p-4 rounded-xl transition-all"
              style={
                isSelected
                  ? { border: '2px solid var(--teal)', background: 'var(--teal-bg)' }
                  : { border: '1px solid var(--rule)', background: 'transparent' }
              }
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="sans font-bold text-lg" style={{ color: 'var(--ink)' }}>{plan.name}</span>
                  <span className="mono text-xs px-2 py-0.5 rounded-full font-medium" style={{ border: '1px solid var(--rule)', color: 'var(--ink-60)' }}>
                    {plan.tier.toUpperCase()}
                  </span>
                </div>
                <span className="serif text-lg font-bold" style={{ color: 'var(--ink)' }}>
                  &#8377;{plan.weekly_premium_inr}
                  <span className="sans text-xs font-normal" style={{ color: 'var(--ink-60)' }}>/week</span>
                </span>
              </div>

              <div className="sans text-sm mb-3" style={{ color: 'var(--ink-60)' }}>
                Max weekly payout: <span className="font-semibold" style={{ color: 'var(--ink)' }}>&#8377;{plan.max_weekly_payout_inr.toLocaleString('en-IN')}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(plan.payout_schedule).map(([event, amount]) => (
                  <div key={event} className="flex justify-between rounded px-2 py-1" style={{ background: 'var(--cream-d)' }}>
                    <span className="sans capitalize" style={{ color: 'var(--ink-60)' }}>{event.replace(/_/g, ' ')}</span>
                    <span className="mono font-medium" style={{ color: 'var(--ink)' }}>&#8377;{amount}</span>
                  </div>
                ))}
              </div>

              {isSelected && (
                <div className="mt-3 text-center">
                  <span className="sans text-sm font-medium" style={{ color: 'var(--teal)' }}>&#10003; Selected</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex gap-3 mt-6">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-3 rounded-lg font-medium transition-colors"
          style={{ border: '1px solid var(--rule)', color: 'var(--ink-60)', background: 'transparent' }}
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => selected && onNext(selected)}
          disabled={!selected}
          className="flex-1 py-3 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'var(--teal)', color: '#fff' }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
