'use client';

import { useState } from 'react';
import { aadhaarSchema } from '@/lib/validations/schemas';

interface AadhaarKycStepProps {
  onNext: (aadhaarHash: string) => void;
  onBack: () => void;
}

function hashLast4(aadhaar: string): string {
  const last4 = aadhaar.slice(-4);
  // Simple mock hash: in production use a proper hash
  const masked = aadhaar.slice(0, 8).replace(/\d/g, 'X') + last4;
  return btoa(masked);
}

export default function AadhaarKycStep({ onNext, onBack }: AadhaarKycStepProps) {
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);

  const handleVerify = () => {
    setError('');
    const result = aadhaarSchema.safeParse({ aadhaar_number: aadhaarNumber });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid Aadhaar number');
      return;
    }

    setVerifying(true);
    // Mock verification delay
    setTimeout(() => {
      setVerifying(false);
      setVerified(true);
    }, 1500);
  };

  const handleContinue = () => {
    const hashed = hashLast4(aadhaarNumber);
    onNext(hashed);
  };

  return (
    <div>
      <h3 className="serif text-lg font-semibold mb-1" style={{ color: 'var(--ink)' }}>Aadhaar KYC</h3>
      <p className="sans text-sm mb-6" style={{ color: 'var(--ink-60)' }}>
        Enter your 12-digit Aadhaar number for identity verification.
      </p>

      <div className="space-y-4">
        <div>
          <label htmlFor="aadhaar" className="mono block text-sm font-medium mb-1" style={{ color: 'var(--ink-60)' }}>
            Aadhaar Number
          </label>
          <input
            id="aadhaar"
            type="text"
            maxLength={12}
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="XXXX XXXX XXXX"
            value={aadhaarNumber}
            onChange={(e) => {
              setAadhaarNumber(e.target.value.replace(/\D/g, ''));
              setVerified(false);
              setError('');
            }}
            disabled={verifying || verified}
            className="w-full px-4 py-3 rounded-lg outline-none text-lg tracking-widest disabled:opacity-60"
            style={{ border: '1px solid var(--rule)', background: 'transparent', color: 'var(--ink)' }}
          />
          {error && <p className="text-sm mt-1" style={{ color: 'var(--red-acc)' }}>{error}</p>}
        </div>

        {verified ? (
          <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: 'var(--teal-bg)', border: '1px solid var(--teal)' }}>
            <span className="text-lg" style={{ color: 'var(--teal)' }}>&#10003;</span>
            <span className="sans text-sm font-medium" style={{ color: 'var(--teal-d)' }}>Aadhaar verified successfully</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleVerify}
            disabled={aadhaarNumber.length !== 12 || verifying}
            className="w-full py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'var(--ink)', color: 'var(--cream)' }}
          >
            {verifying ? 'Verifying...' : 'Verify Aadhaar'}
          </button>
        )}
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
          onClick={handleContinue}
          disabled={!verified}
          className="flex-1 py-3 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'var(--teal)', color: '#fff' }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
