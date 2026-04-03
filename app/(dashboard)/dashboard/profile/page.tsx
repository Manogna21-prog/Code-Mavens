'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { LANGUAGES } from '@/lib/config/constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProfileData {
  full_name: string | null;
  phone_number: string | null;
  city: string | null;
  dl_number: string | null;
  rc_number: string | null;
  upi_id: string | null;
  language: string;
  referral_code: string | null;
  trust_score: number;
  email: string;
}

// ---------------------------------------------------------------------------
// Sign-Out Button
// ---------------------------------------------------------------------------

function SignOutButton() {
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = '/login';
    } catch {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      style={{
        width: '100%',
        padding: '14px 0',
        borderRadius: 12,
        border: '1px solid var(--red-acc)',
        background: 'transparent',
        color: 'var(--red-acc)',
        fontWeight: 600,
        fontSize: 14,
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.6 : 1,
        fontFamily: 'var(--font-sans)',
      }}
    >
      {loading ? 'Signing out...' : 'Sign Out'}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Toggle Switch
// ---------------------------------------------------------------------------

function ToggleSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div
      onClick={onToggle}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        background: on ? 'var(--teal)' : 'var(--ink-10, #e5e5e5)',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 0.2s ease',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#ffffff',
          position: 'absolute',
          top: 2,
          left: on ? 22 : 2,
          transition: 'left 0.2s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section Header
// ---------------------------------------------------------------------------

function SectionHeader({ title }: { title: string }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--ink-60)',
        marginBottom: 12,
      }}
    >
      {title}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card wrapper
// ---------------------------------------------------------------------------

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: 'var(--cream)',
        borderRadius: 16,
        padding: 20,
        border: '1px solid var(--rule)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Info Row (profile details)
// ---------------------------------------------------------------------------

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 12,
        borderBottom: '1px solid var(--ink-10, #e5e5e5)',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          color: 'var(--ink-60)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--ink)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notification Row
// ---------------------------------------------------------------------------

function NotificationRow({
  label,
  on,
  onToggle,
  last,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: last ? 0 : 14,
        marginBottom: last ? 0 : 14,
        borderBottom: last ? 'none' : '1px solid var(--ink-10, #e5e5e5)',
      }}
    >
      <span style={{ fontSize: 14, color: 'var(--ink)' }}>{label}</span>
      <ToggleSwitch on={on} onToggle={onToggle} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Support Row
// ---------------------------------------------------------------------------

function SupportRow({
  label,
  href,
  subtitle,
  last,
}: {
  label: string;
  href?: string;
  subtitle?: string;
  last?: boolean;
}) {
  const content = (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: last ? 0 : 14,
        marginBottom: last ? 0 : 14,
        borderBottom: last ? 'none' : '1px solid var(--ink-10, #e5e5e5)',
        cursor: 'pointer',
      }}
    >
      <div>
        <div style={{ fontSize: 14, color: 'var(--ink)' }}>{label}</div>
        {subtitle && (
          <div style={{ fontSize: 12, color: 'var(--ink-60)', marginTop: 2 }}>{subtitle}</div>
        )}
      </div>
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        style={{ flexShrink: 0, opacity: 0.4 }}
      >
        <path
          d="M6 3L11 8L6 13"
          stroke="var(--ink)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );

  if (href) {
    return (
      <a href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
        {content}
      </a>
    );
  }
  return content;
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function ProfileSkeleton() {
  return (
    <div style={{ padding: '28px 20px', background: 'var(--cream)' }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .skel {
          background: linear-gradient(90deg, #f0efeb 25%, #e8e7e3 50%, #f0efeb 75%);
          background-size: 800px 100%;
          animation: shimmer 1.8s ease-in-out infinite;
          border-radius: 16px;
        }
      `}</style>
      <div className="skel" style={{ width: 80, height: 20, marginBottom: 20, borderRadius: 8 }} />
      <div className="skel" style={{ height: 200, marginBottom: 16 }} />
      <div className="skel" style={{ height: 120, marginBottom: 16 }} />
      <div className="skel" style={{ height: 260, marginBottom: 16 }} />
      <div className="skel" style={{ height: 200, marginBottom: 16 }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Notification prefs (UI-only, not persisted)
  const [pushNotif, setPushNotif] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(true);
  const [emailUpdates, setEmailUpdates] = useState(false);
  const [weatherWarnings, setWeatherWarnings] = useState(true);
  const [premiumReminders, setPremiumReminders] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          window.location.href = '/login';
          return;
        }

        const { data } = await supabase
          .from('profiles')
          .select(
            'full_name, phone_number, city, dl_number, rc_number, upi_id, language, referral_code, trust_score',
          )
          .eq('id', user.id)
          .single();

        if (!data) {
          window.location.href = '/login';
          return;
        }

        const row = data as {
          full_name: string | null;
          phone_number: string | null;
          city: string | null;
          dl_number: string | null;
          rc_number: string | null;
          upi_id: string | null;
          language: string;
          referral_code: string | null;
          trust_score: number;
        };

        setProfile({
          full_name: row.full_name,
          phone_number: row.phone_number,
          city: row.city,
          dl_number: row.dl_number,
          rc_number: row.rc_number,
          upi_id: row.upi_id,
          language: row.language,
          referral_code: row.referral_code,
          trust_score: row.trust_score,
          email: user.email ?? '',
        });
      } catch {
        window.location.href = '/login';
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  if (loading || !profile) return <ProfileSkeleton />;

  const langLabel =
    LANGUAGES.find((l) => l.code === profile.language)?.label || profile.language;
  const trustPercent = (profile.trust_score * 100).toFixed(0);
  const trustColor =
    profile.trust_score >= 0.7
      ? 'var(--teal)'
      : profile.trust_score >= 0.4
        ? 'var(--ink-60)'
        : 'var(--red-acc)';

  const handleCopy = () => {
    if (profile.referral_code) {
      navigator.clipboard.writeText(profile.referral_code).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={{ padding: '28px 20px', background: 'var(--cream)', minHeight: '100vh' }}>
      {/* ── Page Title ── */}
      <h1
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 22,
          fontWeight: 700,
          color: 'var(--ink)',
          marginBottom: 20,
          letterSpacing: '-0.02em',
        }}
      >
        Profile
      </h1>

      {/* ── Profile Info Card ── */}
      <Card style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--ink)',
              }}
            >
              {profile.full_name || 'Driver'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-60)', marginTop: 2 }}>
              {profile.email}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--ink-60)',
              }}
            >
              Trust Score
            </div>
            <div
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 22,
                fontWeight: 700,
                color: trustColor,
              }}
            >
              {trustPercent}%
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <InfoRow label="Phone" value={profile.phone_number || 'Not set'} />
          <InfoRow label="City" value={profile.city || 'Not set'} />
          <InfoRow label="DL Number" value={profile.dl_number || 'Not uploaded'} />
          <InfoRow label="RC Number" value={profile.rc_number || 'Not uploaded'} />
          <InfoRow label="UPI ID" value={profile.upi_id || 'Not set'} />
          <InfoRow label="Language" value={langLabel} />
        </div>
      </Card>

      {/* ── Referral Code ── */}
      {profile.referral_code && (
        <Card
          style={{
            marginBottom: 16,
            background: 'var(--teal-bg)',
            border: '1px solid var(--teal)',
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--teal-d)',
              marginBottom: 10,
            }}
          >
            Your Referral Code
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <code
              style={{
                flex: 1,
                fontFamily: 'var(--font-mono)',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 17,
                fontWeight: 700,
                background: 'var(--cream)',
                color: 'var(--ink)',
                border: '1px solid var(--rule)',
              }}
            >
              {profile.referral_code}
            </code>
            <button
              onClick={handleCopy}
              style={{
                fontSize: 13,
                fontWeight: 600,
                padding: '10px 18px',
                borderRadius: 10,
                border: 'none',
                background: 'var(--teal)',
                color: 'var(--cream)',
                cursor: 'pointer',
              }}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </Card>
      )}

      {/* ── Language Selector ── */}
      <Card style={{ marginBottom: 16 }}>
        <SectionHeader title="Language" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {LANGUAGES.map((lang) => (
            <div
              key={lang.code}
              style={{
                textAlign: 'center',
                fontSize: 13,
                padding: '10px 0',
                borderRadius: 10,
                transition: 'all 0.2s ease',
                ...(lang.code === profile.language
                  ? {
                      background: 'var(--teal-bg)',
                      border: '1px solid var(--teal)',
                      color: 'var(--teal-d)',
                      fontWeight: 600,
                    }
                  : {
                      background: 'var(--cream-d)',
                      border: '1px solid var(--rule)',
                      color: 'var(--ink-60)',
                    }),
              }}
            >
              {lang.label}
            </div>
          ))}
        </div>
      </Card>

      {/* ── Notification Preferences ── */}
      <Card style={{ marginBottom: 16 }}>
        <SectionHeader title="Notification Preferences" />
        <NotificationRow
          label="Push Notifications"
          on={pushNotif}
          onToggle={() => setPushNotif(!pushNotif)}
        />
        <NotificationRow
          label="SMS Alerts"
          on={smsAlerts}
          onToggle={() => setSmsAlerts(!smsAlerts)}
        />
        <NotificationRow
          label="Email Updates"
          on={emailUpdates}
          onToggle={() => setEmailUpdates(!emailUpdates)}
        />
        <NotificationRow
          label="Weather Warnings"
          on={weatherWarnings}
          onToggle={() => setWeatherWarnings(!weatherWarnings)}
        />
        <NotificationRow
          label="Premium Reminders"
          on={premiumReminders}
          onToggle={() => setPremiumReminders(!premiumReminders)}
          last
        />
      </Card>

      {/* ── Help & Support ── */}
      <Card style={{ marginBottom: 16 }}>
        <SectionHeader title="Help & Support" />
        <SupportRow label="FAQ" href="/#faq" />
        <SupportRow label="Contact Support" subtitle="support@safeshift.in | 1800-XXX-XXXX" />
        <SupportRow label="Report a Problem" />
        <SupportRow label="Terms of Service" />
        <SupportRow label="Privacy Policy" last />
      </Card>

      {/* ── About SafeShift ── */}
      <Card style={{ marginBottom: 16 }}>
        <SectionHeader title="About SafeShift" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: 12,
              borderBottom: '1px solid var(--ink-10, #e5e5e5)',
            }}
          >
            <span style={{ fontSize: 14, color: 'var(--ink)' }}>Version</span>
            <span
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--ink)',
              }}
            >
              2.0.0
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: 12,
              borderBottom: '1px solid var(--ink-10, #e5e5e5)',
            }}
          >
            <span style={{ fontSize: 14, color: 'var(--ink)' }}>Last updated</span>
            <span
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--ink)',
              }}
            >
              April 2026
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 14, color: 'var(--ink)' }}>Powered by</span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--teal-d)',
              }}
            >
              AI/ML Predictive Models
            </span>
          </div>
        </div>
      </Card>

      {/* ── Danger Zone: Account Actions ── */}
      <Card style={{ marginBottom: 24 }}>
        <SectionHeader title="Account Actions" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <button
            onClick={() => {}}
            style={{
              width: '100%',
              padding: '12px 0',
              borderRadius: 10,
              border: '1px solid var(--rule)',
              background: 'transparent',
              color: 'var(--ink)',
              fontWeight: 500,
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Download My Data
          </button>
          <button
            onClick={() => {}}
            style={{
              width: '100%',
              padding: '12px 0',
              borderRadius: 10,
              border: '1px solid var(--red-acc)',
              background: 'transparent',
              color: 'var(--red-acc)',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Delete Account
          </button>
        </div>
      </Card>

      {/* ── Sign Out ── */}
      <div style={{ marginBottom: 40 }}>
        <SignOutButton />
      </div>
    </div>
  );
}
