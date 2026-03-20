'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { data: signInData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const user = signInData.user;
    if (!user) {
      setError('Login failed — no user returned');
      setLoading(false);
      return;
    }

    // Fetch profile — use the session that was just established
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('onboarding_status, role')
      .eq('id', user.id)
      .single();

    console.log('[Login] Profile fetch:', { profile, error: profileError?.message });

    const p = profile as { onboarding_status: string; role: string } | null;

    if (!p) {
      // Profile fetch failed (possibly RLS issue) — just go to dashboard
      console.warn('[Login] Could not fetch profile, defaulting to dashboard');
      router.push('/dashboard');
      return;
    }

    if (p.role === 'admin') {
      router.push('/admin');
    } else if (p.onboarding_status === 'complete') {
      router.push('/dashboard');
    } else {
      router.push('/onboarding');
    }
  }

  return (
    <div className="rounded-xl p-6" style={{ background: 'var(--cream)', border: '1px solid var(--rule)' }}>
      <h2 className="serif text-xl font-semibold mb-6" style={{ color: 'var(--ink)' }}>Sign In</h2>
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="mono block text-sm font-medium mb-1" style={{ color: 'var(--ink-60)' }}>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            style={{ border: '1px solid var(--rule)', background: 'transparent', color: 'var(--ink)' }}
            placeholder="driver@example.com" required />
        </div>
        <div>
          <label className="mono block text-sm font-medium mb-1" style={{ color: 'var(--ink-60)' }}>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            style={{ border: '1px solid var(--rule)', background: 'transparent', color: 'var(--ink)' }}
            placeholder="Enter your password" required />
        </div>
        {error && <p className="text-sm" style={{ color: 'var(--red-acc)' }}>{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>
      <p className="sans text-center text-sm mt-4" style={{ color: 'var(--ink-60)' }}>
        Don&apos;t have an account?{' '}
        <Link href="/register" className="hover:underline" style={{ color: 'var(--teal)' }}>Register</Link>
      </p>
    </div>
  );
}
