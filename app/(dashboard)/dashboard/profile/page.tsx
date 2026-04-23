'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Shield, Bell, BellOff, CreditCard, Globe, Headphones, ChevronRight, MessageCircle, Phone, RefreshCw, Users, Copy, Check } from 'lucide-react';
import { getTranslator } from '@/lib/i18n/translations';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileData {
  full_name:    string | null;
  phone_number: string | null;
  city:         string | null;
  upi_id:       string | null;
  dl_number:    string | null;
  rc_number:    string | null;
  trust_score:  number;
  member_since: string;
  language:     string;
  auto_renew_enabled: boolean;
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

function tierLabel(score: number, t: (key: string) => string): string {
  if (score >= 0.8) return t('profile.expert');
  if (score >= 0.6) return t('profile.reliable');
  if (score >= 0.4) return t('profile.growing');
  return t('profile.new');
}

// ─── Toggle Switch ───────────────────────────────────────────────────────────

function ToggleSwitch({ on, onToggle, color = '#F07820' }: { on: boolean; onToggle: () => void; color?: string }) {
  return (
    <div onClick={onToggle} style={{ width: 48, height: 28, borderRadius: 14, background: on ? color : '#E5E7EB', position: 'relative', cursor: 'pointer', transition: 'background 0.2s ease', flexShrink: 0 }}>
      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: on ? 23 : 3, transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
    </div>
  );
}

// ─── Sign Out Button ──────────────────────────────────────────────────────────

function SignOutButton() {
  const [loading, setLoading] = useState(false);
  return (
    <>
      <style>{`
        .signout-btn {
          position: relative;
          width: 100%;
          padding: 14px 0;
          border-radius: 12px;
          border: 1.5px solid #F07820;
          background: transparent;
          color: #F07820;
          font-weight: 600;
          font-size: 15px;
          cursor: pointer;
          font-family: var(--font-inter),'Inter',sans-serif;
          overflow: hidden;
          z-index: 0;
          transition: color 0.35s ease;
        }
        .signout-btn::before {
          content: '';
          position: absolute;
          left: 0; right: 0; bottom: 0;
          height: 0;
          background: #F07820;
          z-index: -1;
          transition: height 0.35s ease;
        }
        .signout-btn:hover { color: #fff; }
        .signout-btn:hover::before { height: 100%; }
        .signout-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .signout-btn:disabled:hover { color: #F07820; }
        .signout-btn:disabled:hover::before { height: 0; }
      `}</style>
      <button
        className="signout-btn"
        onClick={async () => { setLoading(true); const s = createClient(); await s.auth.signOut(); window.location.href = '/login'; }}
        disabled={loading}
      >
        {loading ? 'Signing out…' : 'Sign Out'}
      </button>
    </>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div style={{ background: '#F6F7F9', minHeight: '100vh', padding: '24px 20px' }}>
      <style>{`@keyframes prf-shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}.prf-sk{background:linear-gradient(90deg,#e8e9eb 25%,#f0f1f3 50%,#e8e9eb 75%);background-size:800px 100%;animation:prf-shimmer 1.6s ease infinite;border-radius:12px}`}</style>
      <div className="prf-sk" style={{ width: 80, height: 28, marginBottom: 20 }} />
      <div className="prf-sk" style={{ height: 230, marginBottom: 16 }} />
      <div className="prf-sk" style={{ height: 90, marginBottom: 16 }} />
      <div className="prf-sk" style={{ height: 200, marginBottom: 16 }} />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const [profile, setProfile]   = useState<ProfileData | null>(null);
  const [stats, setStats]       = useState<Stats>({ policies: 0, claims: 0, streak: 0 });
  const [loading, setLoading]   = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [langOpen, setLangOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [referOpen, setReferOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [autoPayOpen, setAutoPayOpen] = useState(false);
  const [autoPayEnabled, setAutoPayEnabled] = useState(false);
  const [autoPaySaving, setAutoPaySaving] = useState(false);
  const [savingLang, setSavingLang] = useState(false);

  // Read dark mode + notification prefs from localStorage
  useEffect(() => {
    setDarkMode(localStorage.getItem('safeshift-darkmode') === 'true');
    const notifPref = localStorage.getItem('safeshift-notifications');
    setNotifEnabled(notifPref !== 'false'); // default to enabled
  }, []);

  function toggleDarkMode() {
    const newVal = !darkMode;
    setDarkMode(newVal);
    localStorage.setItem('safeshift-darkmode', String(newVal));
    // Dispatch custom event so layout picks it up immediately (same tab)
    window.dispatchEvent(new Event('darkmode-toggle'));
  }

  function toggleNotifications() {
    const newVal = !notifEnabled;
    setNotifEnabled(newVal);
    localStorage.setItem('safeshift-notifications', String(newVal));
  }

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { window.location.href = '/login'; return; }

        const [profileRes, walletRes, policiesRes, streakRes] = await Promise.all([
          supabase.from('profiles').select('full_name, phone_number, city, upi_id, dl_number, rc_number, trust_score, language, auto_renew_enabled').eq('id', user.id).single(),
          supabase.from('driver_wallet').select('total_claims').eq('driver_id', user.id).single(),
          supabase.from('weekly_policies').select('*', { count: 'exact', head: true }).eq('profile_id', user.id),
          supabase.from('weekly_policies').select('week_start_date, payment_status').eq('profile_id', user.id).order('week_start_date', { ascending: false }).limit(12),
        ]);

        const row = profileRes.data as unknown as { full_name: string | null; phone_number: string | null; city: string | null; upi_id: string | null; dl_number: string | null; rc_number: string | null; trust_score: number; language: string; auto_renew_enabled: boolean } | null;
        if (!row) { window.location.href = '/login'; return; }

        const streakRows = (streakRes.data as unknown as { payment_status: string }[]) || [];
        const walletRow = walletRes.data as unknown as { total_claims: number } | null;
        let streak = 0;
        for (const p of streakRows) { if (p.payment_status === 'paid' || p.payment_status === 'demo') streak++; else break; }

        setProfile({ full_name: row.full_name, phone_number: row.phone_number, city: row.city, upi_id: row.upi_id, dl_number: row.dl_number, rc_number: row.rc_number, trust_score: row.trust_score, language: row.language || 'en', member_since: user.created_at, auto_renew_enabled: row.auto_renew_enabled ?? false });
        setAutoPayEnabled(row.auto_renew_enabled ?? false);
        setStats({ policies: policiesRes.count ?? 0, claims: walletRow?.total_claims ?? 0, streak });
      } catch { window.location.href = '/login'; } finally { setLoading(false); }
    }
    load();
  }, []);

  async function changeLanguage(code: string) {
    if (!profile || code === profile.language) { setLangOpen(false); return; }
    setSavingLang(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) { await supabase.from('profiles').update({ language: code } as never).eq('id', user.id); setProfile({ ...profile, language: code }); }
    setSavingLang(false); setLangOpen(false);
  }

  if (loading || !profile) return <LoadingSkeleton />;

  const t = getTranslator(profile.language);
  const currentLangLabel = LANGUAGES.find(l => l.code === profile.language)?.label || 'English';
  const cityFull = CITY_NAMES[profile.city || ''] || (profile.city || 'City');
  const initial = (profile.full_name || 'D')[0].toUpperCase();
  const tier = tierLabel(profile.trust_score, t);
  const pts = Math.round(profile.trust_score * 2000 + stats.policies * 100);
  const zoneCode = `${(profile.city || 'XX').slice(0, 3).toUpperCase()}-01, ${cityFull}`;
  const memberSince = new Date(profile.member_since).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

  const ACHIEVEMENTS = [
    { emoji: '🛡️', bg: '#FEF3E8', label: `${stats.policies} ${t('profile.policies')}` },
    { emoji: '🔥', bg: '#FEF3E8', label: `${stats.streak}w ${t('profile.streak')}` },
    { emoji: '💰', bg: '#FEF3E8', label: `${stats.claims} ${t('profile.claims')}` },
    { emoji: '👥', bg: '#FEF3E8', label: '3 Referrals' },
  ];

  const DETAILS = [
    { label: 'Phone', value: profile.phone_number?.replace(/^\+?91/, '') || '—' },
    { label: 'City', value: zoneCode },
    { label: 'DL Number', value: profile.dl_number || '—' },
    { label: 'RC Number', value: profile.rc_number || '—' },
    { label: 'UPI ID', value: profile.upi_id || '—' },
    { label: 'Member Since', value: memberSince },
  ];

  // Card style adapts to dark mode
  const cardBg = darkMode ? '#1A1A1A' : '#fff';
  const cardBorder = darkMode ? '#333' : '#E8E8EA';
  const textPrimary = darkMode ? '#F3F4F6' : '#1A1A1A';
  const textSecondary = darkMode ? '#9CA3AF' : '#6B7280';
  const textMuted = darkMode ? '#6B7280' : '#9CA3AF';
  const divider = darkMode ? '#333' : '#F3F4F6';

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 16 }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>

        <h1 style={{ fontSize: 28, fontWeight: 800, color: textPrimary, margin: 0, letterSpacing: '-0.03em', fontFamily: F }}>{t('profile.title')}</h1>

        {/* ══ 1. Profile Header Card ══ */}
        <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'linear-gradient(135deg, #F07820, #FBBF24)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(240,120,32,0.3)' }}>
            <span style={{ fontSize: 38, fontWeight: 800, color: '#fff', fontFamily: F, lineHeight: 1 }}>{initial}</span>
          </div>
          <p style={{ fontSize: 24, fontWeight: 800, color: textPrimary, margin: '12px 0 0', fontFamily: F, textAlign: 'center' }}>{profile.full_name || 'Driver'}</p>
          <p style={{ fontSize: 14, color: textSecondary, margin: '4px 0 0', fontFamily: F }}>{t('profile.porterPartner')} · {cityFull}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
            <Shield size={16} color="#F07820" strokeWidth={1.8} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#F07820', fontFamily: F }}>{tier} · {pts.toLocaleString('en-IN')} pts</span>
          </div>
        </div>

        {/* ══ 3. Achievements ══ */}
        <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            {ACHIEVEMENTS.map(({ emoji, bg, label }) => (
              <div key={label} style={{ flex: 1, background: darkMode ? '#222' : bg, borderRadius: 12, padding: '12px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 28, lineHeight: 1 }}>{emoji}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: textSecondary, textAlign: 'center', fontFamily: F }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ══ 4. Personal Details ══ */}
        <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 20 }}>
          {DETAILS.map(({ label, value }, i) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < DETAILS.length - 1 ? `1px solid ${divider}` : 'none' }}>
              <span style={{ fontSize: 15, color: textMuted, fontFamily: F }}>{label}</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: textPrimary, fontFamily: F, textAlign: 'right', maxWidth: '60%', wordBreak: 'break-all' }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Dark mode removed — defaulting to light */}

        {/* ══ 6. Settings Menu ══ */}
        <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, overflow: 'hidden' }}>
          {/* Notification Settings */}
          <div>
            <div onClick={() => setNotifOpen(!notifOpen)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', cursor: 'pointer', borderBottom: notifOpen ? 'none' : `1px solid ${divider}`, transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = darkMode ? '#222' : '#F9FAFB')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <Bell size={21} color="#F07820" strokeWidth={1.8} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 16, color: textPrimary, fontFamily: F }}>{t('profile.notifications')}</span>
              <ChevronRight size={16} color="#D1D5DB" strokeWidth={2} style={{ flexShrink: 0, transform: notifOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>
            {notifOpen && (
              <div style={{ padding: '12px 20px 16px', background: darkMode ? '#1A1A1A' : '#F9FAFB', borderBottom: `1px solid ${divider}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {notifEnabled ? <Bell size={18} color="#22C55E" /> : <BellOff size={18} color="#9CA3AF" />}
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: textPrimary, margin: 0, fontFamily: F }}>Push Notifications</p>
                      <p style={{ fontSize: 12, color: textMuted, margin: '2px 0 0', fontFamily: F }}>{notifEnabled ? 'You will receive claim & weather alerts' : 'Notifications are turned off'}</p>
                    </div>
                  </div>
                  <ToggleSwitch on={notifEnabled} onToggle={toggleNotifications} color="#22C55E" />
                </div>
                {notifEnabled && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                    {['Claim payouts', 'Weather alerts', 'Premium reminders', 'Zone disruptions'].map(item => (
                      <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: textSecondary, fontFamily: F }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', flexShrink: 0 }} />
                        {item}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Auto-Pay */}
          <div>
            <div onClick={() => setAutoPayOpen(!autoPayOpen)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', cursor: 'pointer', borderBottom: autoPayOpen ? 'none' : `1px solid ${divider}`, transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = darkMode ? '#222' : '#F9FAFB')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <RefreshCw size={21} color="#F07820" strokeWidth={1.8} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 16, color: textPrimary, fontFamily: F }}>Auto-Pay</span>
              <ChevronRight size={16} color="#D1D5DB" strokeWidth={2} style={{ flexShrink: 0, transform: autoPayOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>
            {autoPayOpen && (
              <div style={{ padding: '12px 20px 16px', background: darkMode ? '#1A1A1A' : '#F9FAFB', borderBottom: `1px solid ${divider}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <RefreshCw size={18} color={autoPayEnabled ? '#22C55E' : '#9CA3AF'} />
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: textPrimary, margin: 0, fontFamily: F }}>Auto-Deduction</p>
                      <p style={{ fontSize: 12, color: textMuted, margin: '2px 0 0', fontFamily: F }}>
                        {autoPayEnabled ? 'Auto-pay is enabled' : 'Auto-pay is disabled'}
                      </p>
                    </div>
                  </div>
                  <ToggleSwitch
                    on={autoPayEnabled}
                    onToggle={async () => {
                      if (autoPaySaving) return;
                      const newVal = !autoPayEnabled;
                      setAutoPaySaving(true);
                      try {
                        const res = await fetch('/api/driver/toggle-auto-pay', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ enabled: newVal }),
                        });
                        if (res.ok) {
                          setAutoPayEnabled(newVal);
                        }
                      } catch {
                        // silently fail
                      } finally {
                        setAutoPaySaving(false);
                      }
                    }}
                    color="#22C55E"
                  />
                </div>
                <p style={{ fontSize: 13, color: textSecondary, margin: '8px 0 12px', lineHeight: 1.5, fontFamily: F }}>
                  Enable auto-pay to have your weekly premium automatically deducted via UPI every Sunday at 6:00 AM.
                </p>
                {profile.upi_id && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: darkMode ? '#222' : '#fff', border: `1px solid ${cardBorder}`, marginBottom: 10 }}>
                    <CreditCard size={16} color={textMuted} />
                    <div>
                      <p style={{ fontSize: 11, color: textMuted, margin: 0, fontFamily: F }}>UPI ID</p>
                      <p style={{ fontSize: 14, fontWeight: 600, color: textPrimary, margin: 0, fontFamily: F }}>{profile.upi_id}</p>
                    </div>
                  </div>
                )}
                <p style={{ fontSize: 11, color: textMuted, margin: 0, lineHeight: 1.5, fontFamily: F }}>
                  You can disable this anytime. If auto-pay fails, you&apos;ll have until Monday 6 AM to pay manually.
                </p>
              </div>
            )}
          </div>

          {/* Refer a Porter Partner */}
          <div>
            <div onClick={() => setReferOpen(!referOpen)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', cursor: 'pointer', borderBottom: referOpen ? 'none' : `1px solid ${divider}`, transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = darkMode ? '#222' : '#F9FAFB')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <Users size={21} color="#F07820" strokeWidth={1.8} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 16, color: textPrimary, fontFamily: F }}>Refer a Porter Partner</span>
              <ChevronRight size={16} color="#D1D5DB" strokeWidth={2} style={{ flexShrink: 0, transform: referOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>
            {referOpen && (
              <div style={{ padding: '12px 20px 16px', background: darkMode ? '#1A1A1A' : '#F9FAFB', borderBottom: `1px solid ${divider}` }}>
                <p style={{ fontSize: 13, color: textSecondary, lineHeight: 1.5, margin: '0 0 12px', fontFamily: F }}>
                  Share your referral code with other Porter LCV drivers. You earn <strong style={{ color: '#F07820' }}>100 SafeShift Coins</strong> when they sign up!
                </p>

                {/* Referral code */}
                {(() => {
                  const code = profile.phone_number
                    ? `SAFE${profile.phone_number.slice(-4)}`
                    : 'SAFE0000';
                  const shareText = `Hey! I use SafeShift for parametric insurance on Porter. Sign up with my code ${code} and we both get rewarded. https://safeshift.in/join?ref=${code}`;

                  return (
                    <>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '12px 14px', borderRadius: 10,
                        background: darkMode ? '#222' : '#fff',
                        border: `1.5px dashed #F07820`,
                        marginBottom: 12,
                      }}>
                        <span style={{ flex: 1, fontSize: 18, fontWeight: 800, color: '#F07820', letterSpacing: '0.1em', fontFamily: F }}>
                          {code}
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(code);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '6px 12px', borderRadius: 8,
                            background: copied ? '#EEFBF3' : '#FEF3E8',
                            border: 'none', cursor: 'pointer',
                            fontSize: 12, fontWeight: 600,
                            color: copied ? '#22C55E' : '#F07820', fontFamily: F,
                          }}
                        >
                          {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
                        </button>
                      </div>

                      {/* Share button */}
                      <button
                        onClick={() => {
                          if (navigator.share) {
                            navigator.share({ title: 'SafeShift Referral', text: shareText }).catch(() => {});
                          } else {
                            navigator.clipboard.writeText(shareText);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }
                        }}
                        style={{
                          width: '100%', padding: '11px 0', borderRadius: 10,
                          background: '#F07820', color: '#fff', border: 'none',
                          fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: F,
                        }}
                      >
                        Share with Porter Partners
                      </button>
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Language */}
          <div>
            <div onClick={() => setLangOpen(!langOpen)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', cursor: 'pointer', borderBottom: langOpen ? 'none' : `1px solid ${divider}`, transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = darkMode ? '#222' : '#F9FAFB')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <Globe size={21} color="#F07820" strokeWidth={1.8} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 16, color: textPrimary, fontFamily: F }}>Language · {currentLangLabel}</span>
              <ChevronRight size={16} color="#D1D5DB" strokeWidth={2} style={{ flexShrink: 0, transform: langOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>
            {langOpen && (
              <div style={{ padding: '8px 20px 16px', background: darkMode ? '#1A1A1A' : '#F9FAFB', borderBottom: `1px solid ${divider}`, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {LANGUAGES.map((l) => (
                  <button key={l.code} onClick={() => changeLanguage(l.code)} disabled={savingLang}
                    style={{ padding: '8px 16px', borderRadius: 20, border: profile.language === l.code ? '1.5px solid #F07820' : `1px solid ${cardBorder}`, background: profile.language === l.code ? '#FEF3E8' : cardBg, color: profile.language === l.code ? '#F07820' : textPrimary, fontSize: 14, fontWeight: profile.language === l.code ? 700 : 500, cursor: savingLang ? 'wait' : 'pointer', fontFamily: F, transition: 'all 0.15s' }}>
                    {l.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Help & Support */}
          <div>
            <div onClick={() => setHelpOpen(!helpOpen)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', cursor: 'pointer', borderBottom: helpOpen ? 'none' : 'none', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = darkMode ? '#222' : '#F9FAFB')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <Headphones size={21} color="#F07820" strokeWidth={1.8} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 16, color: textPrimary, fontFamily: F }}>{t('profile.helpSupport')}</span>
              <ChevronRight size={16} color="#D1D5DB" strokeWidth={2} style={{ flexShrink: 0, transform: helpOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>
            {helpOpen && (
              <div style={{ padding: '12px 20px 16px', background: darkMode ? '#1A1A1A' : '#F9FAFB' }}>
                {/* Toll-free number */}
                <a href="tel:18001234567" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: darkMode ? '#222' : '#fff', border: `1px solid ${cardBorder}`, textDecoration: 'none', marginBottom: 8, transition: 'all 0.15s' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Phone size={20} color="#22C55E" />
                  </div>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: textPrimary, margin: 0, fontFamily: F }}>1800-123-4567</p>
                    <p style={{ fontSize: 12, color: textMuted, margin: '2px 0 0', fontFamily: F }}>Toll-free · 24/7 support</p>
                  </div>
                </a>
                {/* Chat with AI */}
                <Link href="/dashboard/ai" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: darkMode ? '#222' : '#fff', border: `1px solid ${cardBorder}`, textDecoration: 'none', transition: 'all 0.15s' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MessageCircle size={20} color="#8B5CF6" />
                  </div>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: textPrimary, margin: 0, fontFamily: F }}>Chat with AI Assistant</p>
                    <p style={{ fontSize: 12, color: textMuted, margin: '2px 0 0', fontFamily: F }}>Get instant help with claims, policies & more</p>
                  </div>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* ══ Sign Out ══ */}
        <SignOutButton />
      </div>
    </div>
  );
}
