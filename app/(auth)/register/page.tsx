'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError('Please enter a valid 10-digit Indian mobile number');
      setLoading(false);
      return;
    }

    try {
      // Create user via admin API (bypasses email verification & rate limits)
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, phone_number: phone, email: email || undefined, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registration failed');
        setLoading(false);
        return;
      }

      // Now sign in with the created credentials
      const supabase = createClient();
      const loginEmail = data.email || email || `${phone}@safeshift.app`;
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (signInError) {
        setError(`Account created! Please sign in with: ${loginEmail}`);
        setLoading(false);
        return;
      }

      router.push('/onboarding');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl p-6" style={{ background: 'var(--cream)', border: '1px solid var(--rule)' }}>
      <h2 className="serif text-xl font-semibold mb-6" style={{ color: 'var(--ink)' }}>Create Account</h2>
      <form onSubmit={handleRegister} className="space-y-4">
        <div>
          <label className="mono block text-sm font-medium mb-1" style={{ color: 'var(--ink-60)' }}>Full Name</label>
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            style={{ border: '1px solid var(--rule)', background: 'transparent', color: 'var(--ink)' }}
            placeholder="Rajesh Kumar" required />
        </div>
        <div>
          <label className="mono block text-sm font-medium mb-1" style={{ color: 'var(--ink-60)' }}>Mobile Number</label>
          <div className="flex">
            <span className="mono inline-flex items-center px-3 rounded-l-lg text-sm" style={{ background: 'var(--cream-d)', border: '1px solid var(--rule)', borderRight: 'none', color: 'var(--ink-60)' }}>+91</span>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              className="w-full px-3 py-2 rounded-r-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              style={{ border: '1px solid var(--rule)', background: 'transparent', color: 'var(--ink)' }}
              placeholder="9876543210" required />
          </div>
        </div>
        <div>
          <label className="mono block text-sm font-medium mb-1" style={{ color: 'var(--ink-60)' }}>
            Email <span className="font-normal" style={{ color: 'var(--ink-30)' }}>(optional)</span>
          </label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            style={{ border: '1px solid var(--rule)', background: 'transparent', color: 'var(--ink)' }}
            placeholder="driver@example.com" />
        </div>
        <div>
          <label className="mono block text-sm font-medium mb-1" style={{ color: 'var(--ink-60)' }}>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            style={{ border: '1px solid var(--rule)', background: 'transparent', color: 'var(--ink)' }}
            placeholder="Min 6 characters" minLength={6} required />
        </div>
        {error && <p className="text-sm" style={{ color: 'var(--red-acc)' }}>{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Creating account...' : 'Register'}
        </Button>
      </form>
      <p className="sans text-center text-sm mt-4" style={{ color: 'var(--ink-60)' }}>
        Already have an account?{' '}
        <Link href="/login" className="hover:underline" style={{ color: 'var(--teal)' }}>Sign in</Link>
      </p>
    </div>
  );
}
