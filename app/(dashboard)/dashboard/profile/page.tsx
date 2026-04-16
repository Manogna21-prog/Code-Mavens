'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Shield, Sun, Bell, CreditCard, Globe, Headphones, Phone, Download, ChevronRight } from 'lucide-react';
import { getTranslator } from '@/lib/i18n/translations';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileData {
  full_name:    string | null;
  phone_number: string | null;
  city:         string | null;
  upi_id:       string | null;
  trust_score:  number;
  member_since: string;
  language:     string;
}

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'ml', label: 'മലയാളം' },
];

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

function tierLabelKey(score: number): string {
  if (score >= 0.8) return 'profile.expert';
  if (score >= 0.6) return 'profile.reliable';
  if (score >= 0.4) return 'profile.growing';
  return 'profile.new';
}

// ─── Sign Out Button ──────────────────────────────────────────────────────────

function SignOutButton({ label, loadingLabel }: { label: string; loadingLabel: string }) {
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
      {loading ? loadingLabel : label}
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
  const [langOpen, setLangOpen] = useState(false);
  const [savingLang, setSavingLang] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { window.location.href = '/login'; return; }

        const [profileRes, walletRes, policiesRes, streakRes] = await Promise.all([
          supabase.from('profiles')
            .select('full_name, phone_number, city, upi_id, trust_score, language')
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
          language: string;
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
          language:     row.language || 'en',
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

  async function changeLanguage(code: string) {
    if (!profile || code === profile.language) { setLangOpen(false); return; }
    setSavingLang(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({ language: code } as never).eq('id', user.id);
      setProfile({ ...profile, language: code });
    }
    setSavingLang(false);
    setLangOpen(false);
  }

  if (loading || !profile) return <LoadingSkeleton />;

  const t = getTranslator(profile.language);
  const currentLangLabel = LANGUAGES.find(l => l.code === profile.language)?.label || 'English';
  const cityFull   = CITY_NAMES[profile.city || ''] || (profile.city || 'City');
  const initial    = (profile.full_name || 'D')[0].toUpperCase();
  const tier       = t(tierLabelKey(profile.trust_score));
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
    { label: t('profile.mobile'),      value: profile.phone_number || '—' },
    { label: t('profile.platform'),    value: 'Porter'                     },
    { label: t('profile.zone'),        value: zoneCode                     },
    { label: t('profile.shift'),       value: t('profile.fullDay')         },
    { label: t('profile.memberSince'), value: memberSince                  },
    { label: t('profile.upi'),         value: profile.upi_id || '—'       },
  ];

  return (
    <div style={{ background: '#F6F7F9', minHeight: '100vh', paddingBottom: 16 }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ══ Screen Title ══ */}
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1A1A1A', margin: 0, letterSpacing: '-0.03em', fontFamily: F }}>
          {t('profile.title')}
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
            {t('profile.porterPartner')} · {cityFull}
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
            { value: String(stats.policies), color: '#F07820', label: t('profile.policies') },
            { value: String(stats.claims),   color: '#16A34A', label: t('profile.claims')   },
            { value: `${stats.streak}w`,     color: '#F07820', label: t('profile.streak')   },
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
            {t('profile.achievements')}
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
              <p style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A', margin: 0, fontFamily: F }}>{t('profile.darkMode')}</p>
              <p style={{ fontSize: 13, color: '#9CA3AF', margin: '2px 0 0', fontFamily: F }}>
                {darkMode ? t('profile.darkActive') : t('profile.lightActive')}
              </p>
            </div>
            <DarkToggle on={darkMode} onToggle={() => setDarkMode(!darkMode)} />
          </div>
        </div>

        {/* ══ 6. Settings Menu Card ══ */}
        {(() => {
          const MENU_ROWS = [
            { Icon: Bell,        label: t('profile.notifications'),  action: () => {} },
            { Icon: CreditCard,  label: t('profile.paymentMethods'), action: () => {} },
            { Icon: Globe,       label: `${t('profile.language')} · ${currentLangLabel}`, action: () => setLangOpen(!langOpen) },
            { Icon: Headphones,  label: t('profile.helpSupport'),    action: () => {} },
            { Icon: Phone,       label: t('profile.emergencyContact'), action: () => {} },
            { Icon: Download,    label: t('profile.downloadData'),   action: () => {} },
          ];
          return (
            <div style={{ background: '#fff', border: '1px solid #E8E8EA', borderRadius: 16, overflow: 'hidden' }}>
              {MENU_ROWS.map(({ Icon, label, action }, i) => (
                <div key={label}>
                  <div
                    onClick={action}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '16px 20px', cursor: 'pointer',
                      borderBottom: (i < MENU_ROWS.length - 1 && !(i === 2 && langOpen)) ? '1px solid #F3F4F6' : 'none',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Icon size={21} color="#9CA3AF" strokeWidth={1.8} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 16, color: '#1A1A1A', fontFamily: F }}>{label}</span>
                    <ChevronRight size={16} color="#D1D5DB" strokeWidth={2} style={{ flexShrink: 0, transform: i === 2 && langOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                  </div>

                  {/* Language picker — expands below the Language row */}
                  {i === 2 && langOpen && (
                    <div style={{
                      padding: '8px 20px 16px', background: '#F9FAFB',
                      borderBottom: '1px solid #F3F4F6',
                      display: 'flex', flexWrap: 'wrap', gap: 8,
                    }}>
                      {LANGUAGES.map((l) => (
                        <button
                          key={l.code}
                          onClick={() => changeLanguage(l.code)}
                          disabled={savingLang}
                          style={{
                            padding: '8px 16px', borderRadius: 20,
                            border: profile.language === l.code ? '1.5px solid #F07820' : '1px solid #E5E7EB',
                            background: profile.language === l.code ? '#FEF3E8' : '#ffffff',
                            color: profile.language === l.code ? '#F07820' : '#374151',
                            fontSize: 14, fontWeight: profile.language === l.code ? 700 : 500,
                            cursor: savingLang ? 'wait' : 'pointer',
                            fontFamily: F, transition: 'all 0.15s',
                          }}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })()}

        {/* ══ Sign Out ══ */}
        <SignOutButton label={t('profile.signOut')} loadingLabel={t('profile.signingOut')} />

      </div>

    </div>
  );
}
