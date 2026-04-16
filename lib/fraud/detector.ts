// ============================================================================
// Pre-Claim Fraud Detection Pipeline
// Orchestrates all fraud checks and computes composite fraud_score
// Integrates: duplicate, rapid claims, weather mismatch, location integrity,
//             impossible travel, cluster analysis, trust score weighting
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { FRAUD } from '@/lib/config/constants';
import { checkLocationIntegrity, checkImpossibleTravel } from '@/lib/fraud/location-integrity';
import { checkClusterAnomaly } from '@/lib/fraud/cluster-analysis';
import type { ParametricClaim, LiveDisruptionEvent } from '@/lib/types/database';

interface FraudCheckResult {
  isFlagged: boolean;
  fraudScore: number;
  signals: Record<string, boolean>;
  reasons: string[];
}

/**
 * Check for duplicate claim: same policy + same event = reject
 */
export async function checkDuplicateClaim(policyId: string, eventId: string): Promise<boolean> {
  const supabase = createAdminClient();

  const { count } = await supabase
    .from('parametric_claims')
    .select('*', { count: 'exact', head: true })
    .eq('policy_id', policyId)
    .eq('disruption_event_id', eventId);

  // More than 1 means a duplicate exists (current claim is already in DB)
  return (count ?? 0) > 1;
}

/**
 * Check for rapid claims: >= THRESHOLD claims in 24 hours = flag
 */
export async function checkRapidClaims(profileId: string): Promise<boolean> {
  const supabase = createAdminClient();

  const windowStart = new Date(
    Date.now() - FRAUD.RAPID_CLAIM_WINDOW_HOURS * 60 * 60 * 1000
  ).toISOString();

  const { count } = await supabase
    .from('parametric_claims')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .gte('created_at', windowStart);

  return (count ?? 0) >= FRAUD.RAPID_CLAIM_THRESHOLD;
}

/**
 * Check weather data mismatch: re-verify that event API data matches trigger
 */
export async function checkWeatherMismatch(eventId: string): Promise<boolean> {
  const supabase = createAdminClient();

  const { data: eventRaw } = await supabase
    .from('live_disruption_events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (!eventRaw) return false;

  const event = eventRaw as unknown as LiveDisruptionEvent;

  // If the event was not verified by API, flag it
  if (!event.verified_by_api) {
    return true;
  }

  // If no trigger value or threshold recorded, flag as suspicious
  if (event.trigger_value == null || event.trigger_threshold == null) {
    return true;
  }

  // If trigger value is below threshold, flag as mismatch
  if (event.trigger_value < event.trigger_threshold) {
    return true;
  }

  return false;
}

/**
 * Check daily claim limit for profile — FIXED: compare against MAX_CLAIMS_PER_DAY
 */
export async function checkDailyLimit(profileId: string): Promise<boolean> {
  const supabase = createAdminClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('parametric_claims')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .gte('created_at', todayStart.toISOString());

  // FIX: was `> 1`, now correctly compares against the actual limit
  return (count ?? 0) >= 5; // CLAIM_RULES.MAX_CLAIMS_PER_DAY
}

/**
 * Get driver's trust score (lower = more suspicious)
 * Returns a fraud bonus: low trust adds to fraud score
 */
async function getTrustScorePenalty(profileId: string): Promise<number> {
  const supabase = createAdminClient();

  const { data: profileRaw } = await supabase
    .from('profiles')
    .select('trust_score')
    .eq('id', profileId)
    .single();

  const profile = profileRaw as unknown as { trust_score: number } | null;
  const trustScore = profile?.trust_score ?? FRAUD.TRUST_SCORE_DEFAULT;

  // Trust score is 0.0-1.0. Low trust = high fraud penalty.
  // Default 0.50 → 0 penalty. 0.0 → +0.15 penalty. 1.0 → -0.05 bonus.
  if (trustScore < 0.3) return 0.15;  // Very low trust — significant penalty
  if (trustScore < 0.5) return 0.05;  // Below average — small penalty
  if (trustScore > 0.8) return -0.05; // High trust — small bonus (reward clean history)
  return 0; // Average trust — no adjustment
}

/**
 * Update trust score after fraud determination
 */
export async function updateTrustScore(profileId: string, isClean: boolean): Promise<void> {
  const supabase = createAdminClient();

  const { data: profileRaw } = await supabase
    .from('profiles')
    .select('trust_score')
    .eq('id', profileId)
    .single();

  const profile = profileRaw as unknown as { trust_score: number } | null;
  const currentScore = profile?.trust_score ?? FRAUD.TRUST_SCORE_DEFAULT;

  const adjustment = isClean
    ? FRAUD.TRUST_SCORE_CLEAN_CLAIM   // +0.05 for clean claim
    : FRAUD.TRUST_SCORE_FRAUD_CONFIRMED; // -0.20 for confirmed fraud

  const newScore = Math.min(1.0, Math.max(0.0, currentScore + adjustment));

  await supabase
    .from('profiles')
    .update({ trust_score: newScore } as never)
    .eq('id', profileId);
}

/**
 * Orchestrate ALL fraud checks and compute weighted fraud_score
 * Now includes: location integrity, impossible travel, cluster analysis, trust score
 */
export async function runAllFraudChecks(claimId: string): Promise<FraudCheckResult> {
  const supabase = createAdminClient();

  // Fetch claim with event and profile data
  const { data: claimRaw } = await supabase
    .from('parametric_claims')
    .select('*, live_disruption_events(*)')
    .eq('id', claimId)
    .single();

  if (!claimRaw) {
    return { isFlagged: false, fraudScore: 0, signals: {}, reasons: [] };
  }

  const claim = claimRaw as unknown as ParametricClaim & { live_disruption_events: LiveDisruptionEvent };
  const event = claim.live_disruption_events;

  // Get driver's latest activity log for GPS + IP
  const { data: latestLogRaw } = await supabase
    .from('driver_activity_logs')
    .select('latitude, longitude, ip_address')
    .eq('profile_id', claim.profile_id)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .single();

  const latestLog = latestLogRaw as unknown as {
    latitude: number | null;
    longitude: number | null;
    ip_address: string | null;
  } | null;

  // ── Run all checks in parallel ──────────────────────────────────────

  const [duplicate, rapidClaims, weatherMismatch, dailyLimit] = await Promise.all([
    checkDuplicateClaim(claim.policy_id, claim.disruption_event_id),
    checkRapidClaims(claim.profile_id),
    checkWeatherMismatch(claim.disruption_event_id),
    checkDailyLimit(claim.profile_id),
  ]);

  // ── Location integrity (GPS vs IP) ──────────────────────────────────
  let locationAnomaly = false;
  let impossibleTravel = false;
  const reasons: string[] = [];

  if (latestLog?.latitude != null && latestLog?.longitude != null) {
    // Check GPS vs IP mismatch
    const locationResult = await checkLocationIntegrity(
      latestLog.latitude,
      latestLog.longitude,
      latestLog.ip_address ?? undefined
    );
    locationAnomaly = locationResult.locationAnomaly;
    if (locationAnomaly) {
      reasons.push(locationResult.reason || 'GPS/IP location mismatch');
    }

    // Check impossible travel
    impossibleTravel = await checkImpossibleTravel(
      claim.profile_id,
      latestLog.latitude,
      latestLog.longitude
    );
    if (impossibleTravel) {
      reasons.push(`Impossible travel: >50km in 30min detected`);
    }
  }

  // ── Cluster analysis (syndicate detection) ──────────────────────────
  let clusterFlag = false;
  const clusterResult = await checkClusterAnomaly(claim.disruption_event_id);
  if (clusterResult.isSuspicious) {
    clusterFlag = true;
    reasons.push(clusterResult.reason || 'Syndicate cluster detected');

    // Write cluster signal to fraud_cluster_signals table
    try {
      const windowStart = new Date(Date.now() - FRAUD.CLUSTER_WINDOW_MINUTES * 60 * 1000).toISOString();
      const { data: firstClaim } = await supabase
        .from('parametric_claims')
        .select('created_at')
        .eq('disruption_event_id', claim.disruption_event_id)
        .gte('created_at', windowStart)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();
      const { data: lastClaim } = await supabase
        .from('parametric_claims')
        .select('created_at')
        .eq('disruption_event_id', claim.disruption_event_id)
        .gte('created_at', windowStart)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (firstClaim && lastClaim) {
        const first = firstClaim as unknown as { created_at: string };
        const last = lastClaim as unknown as { created_at: string };
        const windowSeconds = Math.round((new Date(last.created_at).getTime() - new Date(first.created_at).getTime()) / 1000);

        await supabase.from('fraud_cluster_signals').upsert({
          disruption_event_id: claim.disruption_event_id,
          event_type: event?.event_type || null,
          city: event?.city || null,
          claim_count: clusterResult.claimCount,
          first_claim_at: first.created_at,
          last_claim_at: last.created_at,
          window_seconds: windowSeconds,
          unique_devices: clusterResult.uniqueDevices,
          flag_rate: 1.0,
        } as never, { onConflict: 'disruption_event_id' });
      }
    } catch {
      // Best effort — don't fail the fraud check if cluster logging fails
    }
  }

  // ── Trust score penalty ─────────────────────────────────────────────
  const trustPenalty = await getTrustScorePenalty(claim.profile_id);

  // ── Build signals ───────────────────────────────────────────────────

  const signals: Record<string, boolean> = {
    duplicate,
    rapid_claims: rapidClaims,
    weather_mismatch: weatherMismatch,
    daily_limit_exceeded: dailyLimit,
    location_anomaly: locationAnomaly || impossibleTravel,
    cluster: clusterFlag,
  };

  // Log individual reasons
  if (duplicate) reasons.push('Duplicate claim for same policy + event');
  if (rapidClaims) reasons.push(`${FRAUD.RAPID_CLAIM_THRESHOLD}+ claims in ${FRAUD.RAPID_CLAIM_WINDOW_HOURS}h`);
  if (weatherMismatch) reasons.push('Weather data mismatch — trigger value below threshold or unverified');
  if (dailyLimit) reasons.push('Daily claim limit exceeded');

  // ── Compute weighted fraud score ────────────────────────────────────

  let fraudScore = 0;
  if (signals.duplicate)           fraudScore += FRAUD.WEIGHTS.duplicate;        // +0.30
  if (signals.rapid_claims)        fraudScore += FRAUD.WEIGHTS.rapid_claims;     // +0.20
  if (signals.weather_mismatch)    fraudScore += FRAUD.WEIGHTS.weather_mismatch; // +0.15
  if (signals.location_anomaly)    fraudScore += FRAUD.WEIGHTS.location_anomaly; // +0.25
  if (signals.cluster)             fraudScore += FRAUD.WEIGHTS.cluster;          // +0.10

  // Apply trust score adjustment
  fraudScore += trustPenalty;

  // Clamp to [0, 1]
  fraudScore = Math.min(1, Math.max(0, fraudScore));

  const isFlagged = fraudScore >= FRAUD.AUTO_APPROVE_THRESHOLD;

  return { isFlagged, fraudScore, signals, reasons };
}
