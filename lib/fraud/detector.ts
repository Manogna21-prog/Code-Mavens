// ============================================================================
// Pre-Claim Fraud Detection Pipeline
// Orchestrates all fraud checks and computes composite fraud_score
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { FRAUD } from '@/lib/config/constants';
import type { ParametricClaim, LiveDisruptionEvent } from '@/lib/types/database';

interface FraudCheckResult {
  isFlagged: boolean;
  fraudScore: number;
  signals: Record<string, boolean>;
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
 * Check for rapid claims: >= 3 claims in 24 hours = flag
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
 * Check daily claim limit for profile
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

  // More than MAX means over limit (current claim already in DB)
  return (count ?? 0) > 1;
}

/**
 * Orchestrate all fraud checks and compute weighted fraud_score
 */
export async function runAllFraudChecks(claimId: string): Promise<FraudCheckResult> {
  const supabase = createAdminClient();

  // Fetch claim
  const { data: claimRaw } = await supabase
    .from('parametric_claims')
    .select('*')
    .eq('id', claimId)
    .single();

  if (!claimRaw) {
    return { isFlagged: false, fraudScore: 0, signals: {} };
  }

  const claim = claimRaw as unknown as ParametricClaim;

  // Run all checks in parallel
  const [duplicate, rapidClaims, weatherMismatch, dailyLimit] = await Promise.all([
    checkDuplicateClaim(claim.policy_id, claim.disruption_event_id),
    checkRapidClaims(claim.profile_id),
    checkWeatherMismatch(claim.disruption_event_id),
    checkDailyLimit(claim.profile_id),
  ]);

  const signals: Record<string, boolean> = {
    duplicate,
    rapid_claims: rapidClaims,
    weather_mismatch: weatherMismatch,
    daily_limit_exceeded: dailyLimit,
    location_anomaly: false, // Set by location-integrity module if applicable
    cluster: false, // Set by cluster-analysis module if applicable
  };

  // Compute weighted fraud score
  let fraudScore = 0;
  if (signals.duplicate) fraudScore += FRAUD.WEIGHTS.duplicate;
  if (signals.rapid_claims) fraudScore += FRAUD.WEIGHTS.rapid_claims;
  if (signals.weather_mismatch) fraudScore += FRAUD.WEIGHTS.weather_mismatch;
  if (signals.location_anomaly) fraudScore += FRAUD.WEIGHTS.location_anomaly;
  if (signals.cluster) fraudScore += FRAUD.WEIGHTS.cluster;

  // Clamp to [0, 1]
  fraudScore = Math.min(1, Math.max(0, fraudScore));

  const isFlagged = fraudScore >= FRAUD.AUTO_APPROVE_THRESHOLD;

  return { isFlagged, fraudScore, signals };
}
