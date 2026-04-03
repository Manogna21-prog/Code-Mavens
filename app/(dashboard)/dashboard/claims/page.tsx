'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TRIGGERS } from '@/lib/config/constants';
import type { DisruptionType } from '@/lib/config/constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DisruptionEvent {
  event_type: string;
  city: string;
  severity_score: number;
  trigger_value: number | null;
  trigger_threshold: number | null;
}

interface ClaimRow {
  id: string;
  payout_amount_inr: number;
  status: string;
  gate1_passed: boolean | null;
  gate2_passed: boolean | null;
  activity_minutes: number | null;
  gps_within_zone: boolean | null;
  is_flagged: boolean;
  created_at: string;
  live_disruption_events: DisruptionEvent | null;
}

interface DashboardFast {
  profile: {
    full_name: string | null;
    city: string;
  } | null;
}

// ---------------------------------------------------------------------------
// Disruption icons (inline SVG paths, no emoji)
// ---------------------------------------------------------------------------

const DISRUPTION_ICONS: Record<string, React.ReactNode> = {
  heavy_rainfall: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
      <path d="M16 14v6" /><path d="M8 14v6" /><path d="M12 16v6" />
    </svg>
  ),
  aqi_grap_iv: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.7 7.7a7.5 7.5 0 1 0 0 8.6" />
      <path d="M21 12h-4" /><path d="M12 3v4" /><path d="M12 17v4" />
    </svg>
  ),
  cyclone: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 4H3" /><path d="M18 8H6" /><path d="M19 12H9" /><path d="M16 16H5" /><path d="M21 20H3" />
    </svg>
  ),
  platform_outage: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 20h.01" /><path d="M7 20v-4" /><path d="M12 20v-8" /><path d="M17 20V8" />
      <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  curfew_bandh: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="2" rx="1" />
      <path d="M12 2v7" /><path d="M12 15v7" />
      <circle cx="12" cy="12" r="10" strokeDasharray="4 4" />
    </svg>
  ),
};

function getDisruptionIcon(eventType: string): React.ReactNode {
  return DISRUPTION_ICONS[eventType] || (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

type StatusBucket = 'paid' | 'pending' | 'rejected';

function bucketStatus(status: string): StatusBucket {
  if (status === 'paid' || status === 'approved' || status === 'gate2_passed') return 'paid';
  if (status === 'rejected') return 'rejected';
  return 'pending';
}

const STATUS_BADGE_STYLES: Record<StatusBucket, React.CSSProperties> = {
  paid: {
    color: 'var(--teal)',
    border: '1px solid var(--teal)',
    background: 'var(--teal-bg)',
  },
  pending: {
    color: '#b45309',
    border: '1px solid #d97706',
    background: 'rgba(217,119,6,0.06)',
  },
  rejected: {
    color: 'var(--red-acc)',
    border: '1px solid var(--red-acc)',
    background: 'rgba(192,57,43,0.06)',
  },
};

function statusLabel(status: string): string {
  const b = bucketStatus(status);
  if (b === 'paid') return 'SETTLED';
  if (b === 'rejected') return 'REJECTED';
  return 'PROCESSING';
}

const TIMELINE_DOT_COLOR: Record<StatusBucket, string> = {
  paid: 'var(--teal)',
  pending: '#d97706',
  rejected: 'var(--red-acc)',
};

// ---------------------------------------------------------------------------
// Short claim ID
// ---------------------------------------------------------------------------

function shortClaimId(uuid: string): string {
  // Use last 4 chars for uniqueness (seed UUIDs share the same prefix)
  return 'SS-CLM-' + uuid.slice(-4).toUpperCase();
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

// ---------------------------------------------------------------------------
// Checkmark / Cross icons
// ---------------------------------------------------------------------------

function CheckIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function PendingDotIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="5" fill="var(--ink-30)" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ClaimsPage() {
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRenew, setAutoRenew] = useState(false);
  const [upiVerified, setUpiVerified] = useState(false);
  const [nextRenewal, setNextRenewal] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  const fetchClaims = useCallback(async (userId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('parametric_claims')
      .select(
        'id, payout_amount_inr, status, gate1_passed, gate2_passed, activity_minutes, gps_within_zone, is_flagged, created_at, live_disruption_events(event_type, city, severity_score, trigger_value, trigger_threshold)'
      )
      .eq('profile_id', userId)
      .order('created_at', { ascending: false });

    setClaims((data as unknown as ClaimRow[]) || []);
  }, []);

  useEffect(() => {
    async function init() {
      try {
        // Fast dashboard call for user identity + profile data
        const res = await fetch('/api/driver/dashboard?fast=1');
        if (!res.ok) return;
        const dash = await res.json() as DashboardFast & {
          policy?: { week_end?: string } | null;
        };

        // Get the authenticated user from Supabase client
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setProfileId(user.id);

        // Fetch profile for auto-renew / UPI
        const { data: profile } = await supabase
          .from('profiles')
          .select('auto_renew_enabled, upi_verified')
          .eq('id', user.id)
          .single();

        if (profile) {
          setAutoRenew(!!(profile as Record<string, unknown>).auto_renew_enabled);
          setUpiVerified(!!(profile as Record<string, unknown>).upi_verified);
        }

        if (dash.policy?.week_end) {
          setNextRenewal(dash.policy.week_end);
        }

        await fetchClaims(user.id);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [fetchClaims]);

  // Toggle auto-renew
  async function toggleAutoRenew() {
    if (!profileId) return;
    const next = !autoRenew;
    setAutoRenew(next);
    const supabase = createClient();
    await supabase
      .from('profiles')
      .update({ auto_renew_enabled: next } as never)
      .eq('id', profileId);
  }

  // ---------- Computed stats ----------
  const totalClaims = claims.length;
  const paidClaims = claims.filter((c) => bucketStatus(c.status) === 'paid');
  const totalReceived = paidClaims.reduce((sum, c) => sum + Number(c.payout_amount_inr), 0);
  const successRate = totalClaims > 0 ? Math.round((paidClaims.length / totalClaims) * 100) : 0;

  const latestClaim = claims[0] || null;

  // ---------- Loading skeleton ----------
  if (loading) {
    return (
      <div style={{ padding: '20px 16px' }}>
        <style>{`
          @keyframes claimsPulse {
            0%, 100% { opacity: 0.35; }
            50% { opacity: 0.65; }
          }
          .cl-skel {
            background: var(--ink-10);
            border-radius: 8px;
            animation: claimsPulse 1.5s ease-in-out infinite;
          }
        `}</style>
        <div className="cl-skel" style={{ width: 140, height: 16, marginBottom: 20 }} />
        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          <div className="cl-skel" style={{ flex: 1, height: 80 }} />
          <div className="cl-skel" style={{ flex: 1, height: 80 }} />
          <div className="cl-skel" style={{ flex: 1, height: 80 }} />
        </div>
        <div className="cl-skel" style={{ height: 200, marginBottom: 20 }} />
        <div className="cl-skel" style={{ height: 120, marginBottom: 12 }} />
        <div className="cl-skel" style={{ height: 120, marginBottom: 12 }} />
        <div className="cl-skel" style={{ height: 80 }} />
      </div>
    );
  }

  // ---------- Empty state ----------
  if (claims.length === 0) {
    return (
      <div style={{ padding: '20px 16px' }}>
        <h1
          className="serif"
          style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 24 }}
        >
          Claims
        </h1>

        <div
          style={{
            textAlign: 'center',
            padding: '56px 24px',
            border: '1px solid var(--rule)',
            borderRadius: 14,
          }}
        >
          {/* Radar / monitoring icon */}
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--teal)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ margin: '0 auto 16px' }}
          >
            <circle cx="12" cy="12" r="10" opacity="0.25" />
            <circle cx="12" cy="12" r="6" opacity="0.4" />
            <circle cx="12" cy="12" r="2" />
            <path d="M12 2v4" opacity="0.6" />
          </svg>
          <p
            className="serif"
            style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}
          >
            No claims yet
          </p>
          <p
            className="sans"
            style={{ fontSize: 13, color: 'var(--ink-60)', lineHeight: 1.5, maxWidth: 260, margin: '0 auto' }}
          >
            We are monitoring your zone 24/7. Claims trigger automatically when disruption thresholds are breached.
          </p>
        </div>

        {/* Auto-Renew section still shown when no claims */}
        <AutoRenewCard
          autoRenew={autoRenew}
          upiVerified={upiVerified}
          nextRenewal={nextRenewal}
          onToggle={toggleAutoRenew}
        />
      </div>
    );
  }

  // ---------- Main render ----------
  return (
    <div style={{ padding: '20px 16px', maxWidth: 520, margin: '0 auto' }}>
      {/* ---------------------------------------------------------------- */}
      {/* Section 1: Claims Summary Header                                 */}
      {/* ---------------------------------------------------------------- */}
      <h1
        className="serif"
        style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 16 }}
      >
        Claims
      </h1>

      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <StatCard
          label="Total Claims"
          value={String(totalClaims)}
          accent="var(--ink)"
        />
        <StatCard
          label="Received"
          value={`\u20B9${totalReceived.toLocaleString('en-IN')}`}
          accent="var(--teal)"
        />
        <StatCard
          label="Success Rate"
          value={`${successRate}%`}
          accent={successRate >= 80 ? 'var(--teal)' : successRate >= 50 ? '#b45309' : 'var(--red-acc)'}
        />
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Section 2: Latest / Active Claim (featured card)                 */}
      {/* ---------------------------------------------------------------- */}
      {latestClaim && <FeaturedClaimCard claim={latestClaim} />}

      {/* ---------------------------------------------------------------- */}
      {/* Section 3: Claims Timeline                                       */}
      {/* ---------------------------------------------------------------- */}
      {claims.length > 1 && (
        <div style={{ marginTop: 28, marginBottom: 28 }}>
          <p
            className="mono"
            style={{
              fontSize: 10,
              color: 'var(--ink-60)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 16,
            }}
          >
            Claims Timeline
          </p>

          <div style={{ position: 'relative' }}>
            {/* Vertical line */}
            <div
              style={{
                position: 'absolute',
                left: 5,
                top: 6,
                bottom: 6,
                width: 2,
                background: 'var(--ink-10)',
                borderRadius: 1,
              }}
            />

            {claims.slice(1).map((claim, idx) => {
              const bucket = bucketStatus(claim.status);
              const dotColor = TIMELINE_DOT_COLOR[bucket];
              const eventType = claim.live_disruption_events?.event_type as DisruptionType | undefined;
              const triggerCfg = eventType ? TRIGGERS[eventType] : undefined;
              const triggerLabel = triggerCfg?.label || 'Unknown Event';
              const city = claim.live_disruption_events?.city || '--';
              const triggerVal = claim.live_disruption_events?.trigger_value;
              const triggerThresh = claim.live_disruption_events?.trigger_threshold ?? triggerCfg?.threshold;
              const unit = triggerCfg?.unit || '';

              return (
                <div
                  key={claim.id}
                  style={{
                    display: 'flex',
                    gap: 16,
                    paddingBottom: idx < claims.length - 2 ? 20 : 0,
                    position: 'relative',
                  }}
                >
                  {/* Timeline dot */}
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: dotColor,
                      flexShrink: 0,
                      marginTop: 4,
                      position: 'relative',
                      zIndex: 1,
                      boxShadow: `0 0 0 3px var(--cream)`,
                    }}
                  />

                  {/* Card */}
                  <div
                    style={{
                      flex: 1,
                      border: '1px solid var(--rule)',
                      borderRadius: 10,
                      padding: '12px 14px',
                    }}
                  >
                    {/* Top row: event + status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: dotColor, display: 'flex' }}>
                          {getDisruptionIcon(eventType || '')}
                        </span>
                        <div>
                          <p className="sans" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                            {triggerLabel}
                          </p>
                          <p className="mono" style={{ fontSize: 10, color: 'var(--ink-30)' }}>
                            {city} &middot; {formatDate(claim.created_at)}
                          </p>
                        </div>
                      </div>
                      <span
                        className="mono"
                        style={{
                          fontSize: 9,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 100,
                          whiteSpace: 'nowrap',
                          ...STATUS_BADGE_STYLES[bucket],
                        }}
                      >
                        {statusLabel(claim.status)}
                      </span>
                    </div>

                    {/* Payout + trigger value */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10 }}>
                      <span
                        className="serif"
                        style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.03em' }}
                      >
                        {'\u20B9'}{Number(claim.payout_amount_inr).toLocaleString('en-IN')}
                      </span>
                      {triggerVal != null && triggerThresh != null && (
                        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-60)' }}>
                          {triggerVal}{unit} detected, threshold: {triggerThresh}{unit}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Section 4: Auto-Renew Status                                     */}
      {/* ---------------------------------------------------------------- */}
      <AutoRenewCard
        autoRenew={autoRenew}
        upiVerified={upiVerified}
        nextRenewal={nextRenewal}
        onToggle={toggleAutoRenew}
      />
    </div>
  );
}

// ===========================================================================
// Sub-components
// ===========================================================================

// ---------- Stat card (Section 1) ----------

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      style={{
        flex: 1,
        border: '1px solid var(--rule)',
        borderRadius: 10,
        padding: '14px 12px',
        textAlign: 'center',
      }}
    >
      <p
        className="mono"
        style={{
          fontSize: 9,
          color: 'var(--ink-60)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: 6,
        }}
      >
        {label}
      </p>
      <p
        className="serif"
        style={{
          fontSize: 22,
          fontWeight: 900,
          color: accent,
          letterSpacing: '-0.04em',
          lineHeight: 1,
        }}
      >
        {value}
      </p>
    </div>
  );
}

// ---------- Featured claim card (Section 2) ----------

function FeaturedClaimCard({ claim }: { claim: ClaimRow }) {
  const bucket = bucketStatus(claim.status);
  const eventType = claim.live_disruption_events?.event_type as DisruptionType | undefined;
  const triggerCfg = eventType ? TRIGGERS[eventType] : undefined;
  const triggerLabel = triggerCfg?.label || 'Unknown Event';
  const triggerVal = claim.live_disruption_events?.trigger_value;
  const triggerThresh = claim.live_disruption_events?.trigger_threshold ?? triggerCfg?.threshold;
  const unit = triggerCfg?.unit || '';

  const borderColor = bucket === 'paid' ? 'var(--teal)' : bucket === 'rejected' ? 'var(--red-acc)' : '#d97706';

  const gate1 = claim.gate1_passed;
  const gate2 = claim.gate2_passed;
  const gpsOk = claim.gps_within_zone;
  const noDuplicate = !claim.is_flagged;

  const validations: { label: string; passed: boolean | null }[] = [
    { label: 'Environmental data verified', passed: gate1 },
    {
      label: claim.activity_minutes != null
        ? `Driver activity confirmed (${claim.activity_minutes}min active)`
        : 'Driver activity confirmed',
      passed: gate2,
    },
    { label: 'GPS within zone', passed: gpsOk },
    { label: 'No duplicate claims', passed: noDuplicate },
  ];

  return (
    <div
      style={{
        border: '1px solid var(--rule)',
        borderLeft: `3px solid ${borderColor}`,
        borderRadius: 12,
        padding: '18px 16px',
        background: 'linear-gradient(135deg, rgba(13,148,136,0.03) 0%, transparent 60%)',
      }}
    >
      {/* Header: claim ID + status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p className="mono" style={{ fontSize: 11, color: 'var(--ink-30)', letterSpacing: '0.06em' }}>
          {shortClaimId(claim.id)}
        </p>
        <span
          className="mono"
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '3px 10px',
            borderRadius: 100,
            ...STATUS_BADGE_STYLES[bucket],
          }}
        >
          {statusLabel(claim.status)}
        </span>
      </div>

      {/* Event type + icon */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span style={{ color: borderColor, display: 'flex' }}>
          {getDisruptionIcon(eventType || '')}
        </span>
        <div>
          <p className="sans" style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
            {triggerLabel}
          </p>
          {triggerVal != null && triggerThresh != null && (
            <p className="mono" style={{ fontSize: 10, color: 'var(--ink-60)', marginTop: 2 }}>
              {triggerVal}{unit} detected &middot; threshold {triggerThresh}{unit}
            </p>
          )}
        </div>
      </div>

      {/* Triggered time */}
      <p className="mono" style={{ fontSize: 10, color: 'var(--ink-30)', marginTop: 6, marginBottom: 12 }}>
        Triggered {relativeTime(claim.created_at)} &middot; {formatDate(claim.created_at)} at {formatTime(claim.created_at)}
      </p>

      {/* Payout amount */}
      <p
        className="serif"
        style={{
          fontSize: 32,
          fontWeight: 900,
          color: 'var(--ink)',
          letterSpacing: '-0.04em',
          lineHeight: 1,
          marginBottom: 18,
        }}
      >
        {'\u20B9'}{Number(claim.payout_amount_inr).toLocaleString('en-IN')}
      </p>

      {/* Validation checklist */}
      <div
        style={{
          background: 'var(--cream-d)',
          borderRadius: 8,
          padding: '12px 14px',
        }}
      >
        <p
          className="mono"
          style={{
            fontSize: 9,
            color: 'var(--ink-60)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 10,
          }}
        >
          Validation Checklist
        </p>
        {validations.map((v, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              paddingTop: i > 0 ? 8 : 0,
              borderTop: i > 0 ? '1px solid var(--ink-10)' : 'none',
            }}
          >
            {v.passed === true ? (
              <CheckIcon color="var(--teal)" />
            ) : v.passed === false ? (
              <CheckIcon color="var(--red-acc)" />
            ) : (
              <PendingDotIcon />
            )}
            <span
              className="sans"
              style={{
                fontSize: 12,
                color: v.passed === true ? 'var(--ink)' : v.passed === false ? 'var(--red-acc)' : 'var(--ink-30)',
              }}
            >
              {v.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Auto-Renew card (Section 4) ----------

function AutoRenewCard({
  autoRenew,
  upiVerified,
  nextRenewal,
  onToggle,
}: {
  autoRenew: boolean;
  upiVerified: boolean;
  nextRenewal: string | null;
  onToggle: () => void;
}) {
  return (
    <div
      style={{
        border: '1px solid var(--rule)',
        borderRadius: 12,
        padding: '16px',
        marginTop: 24,
      }}
    >
      <p
        className="mono"
        style={{
          fontSize: 10,
          color: 'var(--ink-60)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: 14,
        }}
      >
        Auto-Renew
      </p>

      {/* Toggle row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <span className="sans" style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
          Weekly auto-renewal
        </span>
        <button
          onClick={onToggle}
          type="button"
          style={{
            width: 44,
            height: 24,
            borderRadius: 12,
            border: 'none',
            cursor: 'pointer',
            background: autoRenew ? 'var(--teal)' : 'var(--ink-10)',
            position: 'relative',
            transition: 'background 0.2s',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 2,
              left: autoRenew ? 22 : 2,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: '#fff',
              transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
            }}
          />
        </button>
      </div>

      {/* UPI mandate status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: upiVerified ? 'var(--teal)' : 'var(--ink-30)',
            display: 'inline-block',
          }}
        />
        <span className="sans" style={{ fontSize: 12, color: 'var(--ink-60)' }}>
          UPI Mandate: {upiVerified ? 'Active' : 'Not set up'}
        </span>
      </div>

      {/* Next renewal */}
      {nextRenewal && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--ink-10)',
              display: 'inline-block',
            }}
          />
          <span className="sans" style={{ fontSize: 12, color: 'var(--ink-60)' }}>
            Next renewal:{' '}
            {new Date(nextRenewal).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
      )}
    </div>
  );
}
