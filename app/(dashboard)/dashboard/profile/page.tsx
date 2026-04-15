'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Shield, Sun, MessageCircle, Bell, CreditCard, Globe, Headphones, Phone, Download, ChevronRight } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileData {
  full_name:    string | null;
  phone_number: string | null;
  city:         string | null;
  upi_id:       string | null;
  trust_score:  number;
  member_since: string;
}

interface Stats {
  policies: number;
  claims:   number;
  streak:   number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CITY_NAMES: Record<string, string> = {
  mumbai: 'Mumbai', delhi: 'Delhi', bangalore: 'Bangalore', chennai: 'Chennai',
  pune: 'Pune', hyderabad: 'Hyderabad', kolkata: 'Kolkata',
  ahmedabad: 'Ahmedabad', jaipur: 'Jaipur', lucknow: 'Lucknow',
};

const F = "var(--font-inter),'Inter',sans-serif";

function tierLabel(score: number): string {
  if (score >= 0.8) return 'Expert';
  if (score >= 0.6) return 'Reliable';
  if (score >= 0.4) return 'Growing';
  return 'New';
}

// ─── Sign Out Button ──────────────────────────────────────────────────────────

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
        width: '100%', padding: '14px 0', borderRadius: 12,
        border: '1.5px solid #EF4444', background: 'transparent',
        color: '#EF4444', fontWeight: 600, fontSize: 15,
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.6 : 1, fontFamily: F,
      }}
    >
      {loading ? 'Signing out…' : 'Sign Out'}
    </button>
  );
}

// ─── Dark Mode Toggle ─────────────────────────────────────────────────────────

function DarkToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div
      onClick={onToggle}
      style={{
        width: 48, height: 28, borderRadius: 14,
        background: on ? '#0D9488' : '#E5E7EB',
        position: 'relative', cursor: 'pointer',
        transition: 'background 0.2s ease', flexShrink: 0,
      }}
    >
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        background: '#fff', position: 'absolute', top: 3,
        left: on ? 23 : 3,
        transition: 'left 0.2s ease',
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
      }} />
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div style={{ background: '#F6F7F9', minHeight: '100vh', padding: '24px 20px' }}>
      <style>{`
        @keyframes prf-shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
        .prf-sk {
          background: linear-gradient(90deg,#e8e9eb 25%,#f0f1f3 50%,#e8e9eb 75%);
          background-size: 800px 100%;
          animation: prf-shimmer 1.6s ease infinite;
          border-radius: 12px;
        }
      `}</style>
      <div className="prf-sk" style={{ width: 80, height: 28, marginBottom: 20 }} />
      <div className="prf-sk" style={{ height: 230, marginBottom: 16 }} />
      <div className="prf-sk" style={{ height: 90,  marginBottom: 16 }} />
      <div className="prf-sk" style={{ height: 160, marginBottom: 16 }} />
      <div className="prf-sk" style={{ height: 200, marginBottom: 16 }} />
      <div className="prf-sk" style={{ height: 80 }} />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const [profile, setProfile]   = useState<ProfileData | null>(null);
  const [stats, setStats]       = useState<Stats>({ policies: 0, claims: 0, streak: 0 });
  const [loading, setLoading]   = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { window.location.href = '/login'; return; }

        const [profileRes, walletRes, policiesRes, streakRes] = await Promise.all([
          supabase.from('profiles')
            .select('full_name, phone_number, city, upi_id, trust_score')
            .eq('id', user.id).single(),
          supabase.from('driver_wallet')
            .select('total_claims')
            .eq('driver_id', user.id).single(),
          supabase.from('weekly_policies')
            .select('*', { count: 'exact', head: true })
            .eq('profile_id', user.id),
          supabase.from('weekly_policies')
            .select('week_start_date, payment_status')
            .eq('profile_id', user.id)
            .order('week_start_date', { ascending: false })
            .limit(12),
        ]);

        const row = profileRes.data as unknown as {
          full_name: string | null; phone_number: string | null;
          city: string | null; upi_id: string | null; trust_score: number;
        } | null;
        if (!row) { window.location.href = '/login'; return; }

        const streakRows = (streakRes.data as unknown as { payment_status: string }[]) || [];
        const walletRow  = walletRes.data as unknown as { total_claims: number } | null;

        let streak = 0;
        for (const p of streakRows) {
          if (p.payment_status === 'paid' || p.payment_status === 'demo') streak++;
          else break;
        }

        setProfile({
          full_name:    row.full_name,
          phone_number: row.phone_number,
          city:         row.city,
          upi_id:       row.upi_id,
          trust_score:  row.trust_score,
          member_since: user.created_at,
        });
        setStats({
          policies: policiesRes.count ?? 0,
          claims:   walletRow?.total_claims ?? 0,
          streak,
        });
      } catch {
        window.location.href = '/login';
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading || !profile) return <LoadingSkeleton />;

  const cityFull   = CITY_NAMES[profile.city || ''] || (profile.city || 'City');
  const initial    = (profile.full_name || 'D')[0].toUpperCase();
  const tier       = tierLabel(profile.trust_score);
  const pts        = Math.round(profile.trust_score * 2000 + stats.policies * 100);
  const zoneCode   = `${(profile.city || 'XX').slice(0, 3).toUpperCase()}-01, ${cityFull}`;
  const memberSince = new Date(profile.member_since)
    .toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

  const ACHIEVEMENTS = [
    { emoji: '🛡️', bg: '#F0EDEB', label: `${stats.policies} Policies` },
    { emoji: '🔥', bg: '#FEF9E7', label: `${stats.streak}w Streak`    },
    { emoji: '💰', bg: '#ECFDF5', label: `${stats.claims} Claims`     },
    { emoji: '👥', bg: '#EDE9FE', label: '3 Referrals'                },
  ];

  const DETAILS = [
    { label: 'Mobile',       value: profile.phone_number || '—' },
    { label: 'Platform',     value: 'Porter'                     },
    { label: 'Zone',         value: zoneCode                     },
    { label: 'Shift',        value: 'Full Day (10 hrs)'          },
    { label: 'Member Since', value: memberSince                  },
    { label: 'UPI',          value: profile.upi_id || '—'       },
  ];

  return (
    <div style={{ background: '#F6F7F9', minHeight: '100vh', paddingBottom: 16 }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ══ Screen Title ══ */}
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1A1A1A', margin: 0, letterSpacing: '-0.03em', fontFamily: F }}>
          Profile
        </h1>

        {/* ══ 1. Profile Header Card ══ */}
        <div style={{ background: '#fff', border: '1px solid #E8E8EA', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Avatar */}
          <div style={{
            width: 88, height: 88, borderRadius: '50%',
            background: 'linear-gradient(135deg, #F07820, #FBBF24)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(240,120,32,0.3)',
          }}>
            <span style={{ fontSize: 38, fontWeight: 800, color: '#fff', fontFamily: F, lineHeight: 1 }}>
              {initial}
            </span>
          </div>

          {/* Name */}
          <p style={{ fontSize: 24, fontWeight: 800, color: '#1A1A1A', margin: '12px 0 0', fontFamily: F, textAlign: 'center', lineHeight: 1.2 }}>
            {profile.full_name || 'Driver'}
          </p>

          {/* Subtitle */}
          <p style={{ fontSize: 14, color: '#6B7280', margin: '4px 0 0', textAlign: 'center', fontFamily: F }}>
            Porter Partner · {cityFull}
          </p>

          {/* Tier badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
            <Shield size={16} color="#F07820" strokeWidth={1.8} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#F07820', fontFamily: F }}>
              {tier} · {pts.toLocaleString('en-IN')} pts
            </span>
          </div>
        </div>

        {/* ══ 2. Quick Stats Row ══ */}
        <div style={{ display: 'flex', gap: 12 }}>
          {([
            { value: String(stats.policies), color: '#F07820', label: 'Policies' },
            { value: String(stats.claims),   color: '#16A34A', label: 'Claims'   },
            { value: `${stats.streak}w`,     color: '#F07820', label: 'Streak'   },
          ] as const).map(({ value, color, label }) => (
            <div key={label} style={{
              flex: 1, background: '#fff', border: '1px solid #E8E8EA',
              borderRadius: 14, padding: '16px 0',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
              <span style={{ fontSize: 26, fontWeight: 800, color, fontFamily: F, lineHeight: 1 }}>{value}</span>
              <span style={{ fontSize: 13, color: '#6B7280', fontFamily: F }}>{label}</span>
            </div>
          ))}
        </div>

        {/* ══ 3. Achievements Card ══ */}
        <div style={{ background: '#fff', border: '1px solid #E8E8EA', borderRadius: 16, padding: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 14px', fontFamily: F }}>
            Achievements
          </p>

          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            {ACHIEVEMENTS.map(({ emoji, bg, label }) => (
              <div key={label} style={{
                flex: 1, background: bg, borderRadius: 12, padding: '12px 4px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              }}>
                <span style={{ fontSize: 28, lineHeight: 1 }}>{emoji}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#4B5563', textAlign: 'center', fontFamily: F, lineHeight: 1.3 }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div style={{ height: 6, borderRadius: 3, background: '#E5E7EB', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, Math.round(profile.trust_score * 100))}%`,
              height: '100%', borderRadius: 3,
              background: 'linear-gradient(to right, #F07820, #FBBF24)',
              transition: 'width 0.6s ease',
            }} />
          </div>
        </div>

        {/* ══ 4. Personal Details Card ══ */}
        <div style={{ background: '#fff', border: '1px solid #E8E8EA', borderRadius: 16, padding: 20 }}>
          {DETAILS.map(({ label, value }, i) => (
            <div key={label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 0',
              borderBottom: i < DETAILS.length - 1 ? '1px solid #F3F4F6' : 'none',
            }}>
              <span style={{ fontSize: 15, color: '#9CA3AF', fontFamily: F }}>{label}</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A', fontFamily: F, textAlign: 'right', maxWidth: '60%', wordBreak: 'break-all' }}>
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* ══ 5. Dark Mode Toggle Card ══ */}
        <div style={{ background: '#fff', border: '1px solid #E8E8EA', borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flexShrink: 0 }}>
              <Sun size={22} color="#F59E0B" strokeWidth={2} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A', margin: 0, fontFamily: F }}>Dark Mode</p>
              <p style={{ fontSize: 13, color: '#9CA3AF', margin: '2px 0 0', fontFamily: F }}>
                {darkMode ? 'Dark theme active' : 'Light theme active'}
              </p>
            </div>
            <DarkToggle on={darkMode} onToggle={() => setDarkMode(!darkMode)} />
          </div>
        </div>

        {/* ══ 6. Settings Menu Card ══ */}
        {(() => {
          const MENU_ROWS = [
            { Icon: Bell,        label: 'Notification Settings' },
            { Icon: CreditCard,  label: 'Payment Methods'       },
            { Icon: Globe,       label: 'Language / भाषा'       },
            { Icon: Headphones,  label: 'Help & Support'        },
            { Icon: Phone,       label: 'Emergency Contact'     },
            { Icon: Download,    label: 'Download My Data'      },
          ];
          return (
            <div style={{ background: '#fff', border: '1px solid #E8E8EA', borderRadius: 16, overflow: 'hidden' }}>
              {MENU_ROWS.map(({ Icon, label }, i) => (
                <div
                  key={label}
                  onClick={() => {}}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '16px 20px', cursor: 'pointer',
                    borderBottom: i < MENU_ROWS.length - 1 ? '1px solid #F3F4F6' : 'none',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <Icon size={21} color="#9CA3AF" strokeWidth={1.8} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 16, color: '#1A1A1A', fontFamily: F }}>{label}</span>
                  <ChevronRight size={16} color="#D1D5DB" strokeWidth={2} style={{ flexShrink: 0 }} />
                </div>
              ))}
            </div>
          );
        })()}

        {/* ══ Sign Out ══ */}
        <SignOutButton />

      </div>

      {/* ══ Floating AI Chat Button ══ */}
      <button
        aria-label="AI Chat"
        style={{
          position: 'fixed', bottom: 90, right: 20, zIndex: 50,
          width: 56, height: 56, borderRadius: '50%',
          background: 'linear-gradient(135deg, #F07820, #1A40C0)',
          border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <MessageCircle size={24} color="#fff" strokeWidth={2} />
        <span style={{
          position: 'absolute', top: -2, right: -2,
          background: '#EF4444', color: '#fff',
          fontSize: 10, fontWeight: 700,
          borderRadius: 9, padding: '2px 5px',
          fontFamily: F, lineHeight: 1.4,
          border: '1.5px solid #F6F7F9',
        }}>AI</span>
      </button>
    </div>
  );
}
