'use client';

import { useState } from 'react';
import { PLAN_PACKAGES, type TierType } from '@/lib/config/constants';
import { openRazorpayCheckout, type RazorpaySuccessResponse } from '@/lib/payments/razorpay-checkout';
import { getFirstPolicyStartDate } from '@/lib/utils/date';

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

  // Calculate expected first policy activation date
  const activationDate = getFirstPolicyStartDate();
  const activationDateStr = activationDate.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const handlePay = async () => {
    setProcessing(true);
    setError('');

    try {
      // Step 1: Create Razorpay order
      const orderRes = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_slug: tier }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        setError(orderData.error || 'Failed to create payment order');
        setProcessing(false);
        return;
      }

      const { orderId, amount, plan_id: planId } = orderData;

      // Step 2: Open Razorpay checkout
      await openRazorpayCheckout({
        orderId,
        amount,
        description: `SafeShift ${plan.name} Plan - Weekly Premium`,
        onSuccess: async (response: RazorpaySuccessResponse) => {
          try {
            // Step 3: Verify payment
            const verifyRes = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                plan_id: planId,
                type: 'onboarding',
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) {
              setError(verifyData.error || 'Payment verification failed');
              setProcessing(false);
              return;
            }

            // Step 4: Proceed to next step
            onNext();
          } catch (verifyErr) {
            setError(verifyErr instanceof Error ? verifyErr.message : 'Payment verification failed');
            setProcessing(false);
          }
        },
        onFailure: (errorMsg: string) => {
          setError(errorMsg || 'Payment failed. Please try again.');
          setProcessing(false);
        },
        onDismiss: () => {
          setProcessing(false);
        },
      });
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
          <span className="serif text-xl font-bold" style={{ color: '#F07820' }}>&#8377;{plan.weekly_premium_inr}</span>
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

      {/* Waiting Period Notice */}
      <div className="rounded-lg p-4 mb-4" style={{ background: 'rgba(240,120,32,0.06)', border: '1px solid rgba(240,120,32,0.2)' }}>
        <p className="sans text-sm font-semibold mb-1" style={{ color: '#F07820' }}>
          7-13 Day Waiting Period
        </p>
        <p className="sans text-xs" style={{ color: 'var(--ink-60)', lineHeight: 1.5 }}>
          Your policy will activate on <strong style={{ color: 'var(--ink)' }}>{activationDateStr}</strong>.
          You&apos;ll be covered from that Monday. This waiting period applies only to your first policy.
        </p>
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
          style={{ background: '#F07820', color: '#fff' }}
        >
          {processing ? 'Processing...' : `Pay \u20B9${plan.weekly_premium_inr}`}
        </button>
      </div>

      <p className="mono text-xs text-center mt-4" style={{ color: 'var(--ink-30)' }}>
        Powered by Razorpay. Payments are secure and encrypted.
      </p>
    </div>
  );
}
