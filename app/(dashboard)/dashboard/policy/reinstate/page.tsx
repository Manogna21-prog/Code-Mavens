'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PLAN_PACKAGES } from '@/lib/config/constants';
import { ArrowLeft, Shield, CloudRain, Wind, MapPin } from 'lucide-react';

const F = "var(--font-inter),'Inter',sans-serif";

interface PremiumQuote {
  basePremium: number;
  weatherRisk: number;
  ubiAddon: number;
  finalPremium: number;
  reasoning: string;
  breakdown?: {
    rainfall_probability: number;
    wind_probability: number;
    aqi_probability: number;
    combined_risk_score: number;
  };
}

export default function ReinstatePolicyPage() {
  const router = useRouter();
  const params = useSearchParams();
  const tier = params.get('tier') || 'normal';

  const [quote, setQuote] = useState<PremiumQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  const plan = PLAN_PACKAGES.find((p) => p.slug === tier);

  useEffect(() => {
    async function fetchQuote() {
      try {
        const res = await fetch('/api/driver/premium-quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tier }),
        });
        if (!res.ok) throw new Error('Failed to fetch premium');
        const data = await res.json();
        setQuote(data);
      } catch {
        setError('Could not calculate premium. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    fetchQuote();
  }, [tier]);

  const handlePay = async () => {
    setPaying(true);
    setError('');
    try {
      const res = await fetch('/api/driver/reinstate-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Payment failed'); setPaying(false); return; }
      router.push('/dashboard');
    } catch {
      setError('Payment failed. Please try again.');
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 20px', fontFamily: F }}>
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#6B7280' }}>
          <p style={{ fontSize: 15, fontWeight: 600 }}>Calculating your premium...</p>
          <p style={{ fontSize: 13, marginTop: 8 }}>Using live weather data + your zone risk</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 20px', fontFamily: F }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
        >
          <ArrowLeft size={22} color="#1A1A1A" />
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1A1A1A', margin: 0 }}>
          Reinstate Policy
        </h1>
      </div>

      {error && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10,
          padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#DC2626',
        }}>{error}</div>
      )}

      {/* Plan info */}
      <div style={{
        background: '#fff', border: '1px solid #E8E8EA', borderRadius: 14,
        padding: 20, marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Shield size={20} color="#F07820" />
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A' }}>{plan?.name ?? tier} Plan</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: '#6B7280' }}>Max Weekly Payout</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>
            ₹{plan?.max_weekly_payout_inr.toLocaleString('en-IN') ?? '--'}
          </span>
        </div>
        {plan && Object.entries(plan.payout_schedule).map(([event, amount]) => (
          <div key={event} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: '#9CA3AF', textTransform: 'capitalize' }}>{event.replace(/_/g, ' ')}</span>
            <span style={{ fontSize: 12, color: '#6B7280' }}>₹{amount}</span>
          </div>
        ))}
      </div>

      {/* Dynamic premium breakdown */}
      {quote && (
        <div style={{
          background: '#FFF7ED', border: '1.5px solid #FDBA74', borderRadius: 14,
          padding: 20, marginBottom: 16,
        }}>
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9A3412', marginBottom: 14 }}>
            Dynamic Premium Breakdown
          </p>

          {/* Base */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 14, color: '#4B5563' }}>Base Premium ({tier})</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>₹{quote.basePremium}</span>
          </div>

          {/* Weather risk */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CloudRain size={14} color="#6B7280" />
              <span style={{ fontSize: 14, color: '#4B5563' }}>Weather Risk Addon</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#EA580C' }}>+₹{quote.weatherRisk.toFixed(0)}</span>
          </div>

          {/* UBI */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={14} color="#6B7280" />
              <span style={{ fontSize: 14, color: '#4B5563' }}>Zone Risk (UBI)</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#EA580C' }}>+₹{quote.ubiAddon}</span>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: '#FDBA74', marginBottom: 14 }} />

          {/* Final */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A' }}>Weekly Premium</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#F07820' }}>₹{quote.finalPremium.toFixed(0)}</span>
          </div>

          {/* Risk bars */}
          {quote.breakdown && (
            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              {[
                { label: 'Rain', val: quote.breakdown.rainfall_probability },
                { label: 'Wind', val: quote.breakdown.wind_probability },
                { label: 'AQI', val: quote.breakdown.aqi_probability },
              ].map(({ label, val }) => (
                <div key={label} style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: '#9A3412', marginBottom: 3, textAlign: 'center' }}>{label}</div>
                  <div style={{ height: 4, borderRadius: 2, background: '#FDE68A' }}>
                    <div style={{ width: `${Math.min(val * 100, 100)}%`, height: '100%', borderRadius: 2, background: '#F07820' }} />
                  </div>
                  <div style={{ fontSize: 10, color: '#9A3412', marginTop: 2, textAlign: 'center' }}>{(val * 100).toFixed(0)}%</div>
                </div>
              ))}
            </div>
          )}

          {/* Reasoning */}
          <p style={{ fontSize: 12, color: '#9A3412', marginTop: 12, lineHeight: 1.4 }}>
            {quote.reasoning}
          </p>
        </div>
      )}

      {/* Pay button */}
      <button
        onClick={handlePay}
        disabled={paying || !quote}
        style={{
          width: '100%', padding: '14px 0', borderRadius: 10,
          background: paying ? '#FDBA74' : '#F07820', color: '#fff',
          fontSize: 16, fontWeight: 700, border: 'none', cursor: paying ? 'default' : 'pointer',
          fontFamily: F, opacity: paying ? 0.7 : 1,
        }}
      >
        {paying ? 'Processing...' : `Pay ₹${quote?.finalPremium.toFixed(0) ?? '--'} & Reinstate`}
      </button>

      <p style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 10 }}>
        Demo mode — no real payment charged.
      </p>
    </div>
  );
}
