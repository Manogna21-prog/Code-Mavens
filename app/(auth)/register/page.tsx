'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

const ORANGE = '#F07820';

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

      const supabase = createClient();
      const loginEmail = data.email || email || `${phone}@safeshift.app`;
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: loginEmail, password });

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

  const inputStyle: React.CSSProperties = {
    display: 'block', width: '100%', boxSizing: 'border-box',
    padding: '0 1em', height: 48,
    background: '#f9f9f9', border: `1.5px solid #1a1a1a`, borderRadius: 6,
    fontSize: '0.95em', fontWeight: 500, color: '#1a1a1a',
    outline: 'none', fontFamily: "'Inter', sans-serif",
    transition: 'border-color .2s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', marginBottom: 6,
    fontSize: '0.875em', fontWeight: 700, color: '#1a1a1a',
    fontFamily: "'Inter', sans-serif",
  };

  return (
    <div style={{ background: '#ffffff', borderRadius: 16, padding: '2em' }}>
      <Link href="/" style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: '0.8rem', fontWeight: 600, color: '#888',
        textDecoration: 'none', marginBottom: '1em',
        fontFamily: "'Inter', sans-serif",
        transition: 'color 0.15s',
      }}
        onMouseEnter={e => (e.currentTarget.style.color = '#F07820')}
        onMouseLeave={e => (e.currentTarget.style.color = '#888')}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
          <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Back
      </Link>
      <style>{`
        .ss-reg-input:focus { border-color: ${ORANGE} !important; box-shadow: 0 0 0 3px rgba(240,120,32,0.15); }
        .ss-register-btn { position:relative; overflow:hidden; background:#1a1a1a; color:#fff; }
        .ss-register-btn::before { content:''; position:absolute; bottom:0; left:0; width:100%; height:0; background:${ORANGE}; transition:height 0.35s cubic-bezier(0.22,1,0.36,1); z-index:0; }
        .ss-register-btn:hover:not(:disabled)::before { height:100%; }
        .ss-register-btn > span { position:relative; z-index:1; }
      `}</style>

      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '1.25em', textAlign: 'center', fontFamily: "'Inter', sans-serif" }}>
        Create Account
      </h2>

      <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1em' }}>

        <div>
          <label style={labelStyle}>Full Name</label>
          <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
            className="ss-reg-input" style={inputStyle} placeholder="Rajesh Kumar" required />
        </div>

        <div>
          <label style={labelStyle}>Mobile Number</label>
          <div style={{ display: 'flex' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 12px', background: '#f0f0f0', border: '1.5px solid #1a1a1a', borderRight: 'none', borderRadius: '6px 0 0 6px', fontSize: '0.95em', color: '#555', fontFamily: "'Inter', sans-serif" }}>+91</span>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              className="ss-reg-input" style={{ ...inputStyle, borderRadius: '0 6px 6px 0' }}
              placeholder="9876543210" required />
          </div>
        </div>

        <div>
          <label style={labelStyle}>
            Email <span style={{ fontWeight: 400, color: '#999' }}>(optional)</span>
          </label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            className="ss-reg-input" style={inputStyle} placeholder="driver@example.com" />
        </div>

        <div>
          <label style={labelStyle}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            className="ss-reg-input" style={inputStyle} placeholder="Min 6 characters" minLength={6} required />
        </div>

        {error && <p style={{ fontSize: '0.875rem', color: '#e53e3e' }}>{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="ss-register-btn"
          style={{ height: 48, width: '100%', borderRadius: 6, border: 'none', color: '#fff', fontSize: '1em', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'Inter', sans-serif", opacity: loading ? 0.6 : 1 }}
        >
          <span>{loading ? 'Creating account…' : 'Register'}</span>
        </button>
      </form>

      <p style={{ textAlign: 'center', fontSize: '0.875rem', marginTop: '1em', color: '#666', fontFamily: "'Inter', sans-serif" }}>
        Already have an account?{' '}
        <Link href="/login" style={{ color: ORANGE, fontWeight: 600 }}>Sign in</Link>
      </p>
    </div>
  );
}
