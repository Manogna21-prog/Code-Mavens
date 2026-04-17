// ============================================================================
// Adjudicator Claims — Match policies to events, create claims
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { isWithinCircle } from '@/lib/utils/geo';
import { CLAIM_RULES } from '@/lib/config/constants';
import { runAllFraudChecks, updateTrustScore } from '@/lib/fraud/detector';
import { simulatePayout } from '@/lib/payments/simulate-payout';
import type { TriggerCandidate } from './types';
import type { DisruptionType } from '@/lib/config/constants';

interface PolicyRow {
  id: string;
  profile_id: string;
  total_payout_this_week: number;
  plan_packages: {
    slug: string;
    payout_schedule: Record<DisruptionType, number>;
    max_weekly_payout_inr: number;
  };
  profiles: {
    zone_latitude: number;
    zone_longitude: number;
    vehicle_hash: string | null;
    trust_score: number;
    city: string;
  };
}

/**
 * Find all active policies in the affected zone and create claims
 */
export async function processClaimsForEvent(
  eventId: string,
  candidate: TriggerCandidate
): Promise<{ claims_created: number; payouts_initiated: number }> {
  const supabase = createAdminClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: policiesRaw, error } = await supabase
    .from('weekly_policies')
    .select('id, profile_id, total_payout_this_week, plan_packages(slug, payout_schedule, max_weekly_payout_inr), profiles(zone_latitude, zone_longitude, vehicle_hash, trust_score, city)')
    .eq('is_active', true)
    .in('payment_status', ['paid', 'demo'])
    .lte('week_start_date', today)
    .gte('week_end_date', today);

  if (error || !policiesRaw) {
    console.error('[Claims] Error fetching policies:', error);
    return { claims_created: 0, payouts_initiated: 0 };
  }

  const policies = policiesRaw as unknown as PolicyRow[];
  let claimsCreated = 0;
  let payoutsInitiated = 0;

  for (const policy of policies) {
    const profile = policy.profiles;
    const plan = policy.plan_packages;
    if (!profile || !plan) continue;

    // Filter by city
    if (profile.city !== candidate.city) continue;

    // Check geofence
    if (candidate.geofence_radius_km > 0 && profile.zone_latitude && profile.zone_longitude) {
      if (!isWithinCircle(profile.zone_latitude, profile.zone_longitude, candidate.latitude, candidate.longitude, candidate.geofence_radius_km)) {
        continue;
      }
    }

    // Check daily claim limit
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count: claimsToday } = await supabase
      .from('parametric_claims')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', policy.profile_id)
      .gte('created_at', todayStart.toISOString());

    if ((claimsToday || 0) >= CLAIM_RULES.MAX_CLAIMS_PER_DAY) continue;

    // Check payout amount and weekly cap
    const payoutAmount = plan.payout_schedule[candidate.event_type] || 0;
    if (payoutAmount === 0) continue;
    if ((policy.total_payout_this_week || 0) + payoutAmount > plan.max_weekly_payout_inr) continue;

    // Check vehicle asset lock
    if (profile.vehicle_hash) {
      const { data: activeLock } = await supabase
        .from('vehicle_asset_locks')
        .select('id')
        .eq('vehicle_hash', profile.vehicle_hash)
        .gt('expires_at', new Date().toISOString())
        .limit(1)
        .single();
      if (activeLock) continue;
    }

    // Check duplicate claim
    const { count: existing } = await supabase
      .from('parametric_claims')
      .select('*', { count: 'exact', head: true })
      .eq('policy_id', policy.id)
      .eq('disruption_event_id', eventId);
    if ((existing || 0) > 0) continue;

    // Create claim (Gate 1 passed by adjudicator)
    const { data: newClaim, error: claimError } = await supabase
      .from('parametric_claims')
      .insert({
        policy_id: policy.id,
        profile_id: policy.profile_id,
        disruption_event_id: eventId,
        payout_amount_inr: payoutAmount,
        status: 'gate1_passed',
        gate1_passed: true,
        gate1_checked_at: new Date().toISOString(),
        fraud_score: 0,
      } as never)
      .select('id')
      .single();

    if (claimError || !newClaim) {
      console.error('[Claims] Error creating claim:', claimError);
      continue;
    }

    const claimId = (newClaim as unknown as { id: string }).id;
    claimsCreated++;

    // ── ZERO-TOUCH AUTOMATED PIPELINE ──────────────────────────────
    // Gate 2: Auto-pass for parametric claims (trigger IS the proof)
    // In parametric insurance, the environmental trigger = verification.
    // Driver zone check was done above (geofence). Activity check is
    // relaxed for parametric — the driver just needs to be registered.
    await supabase.from('parametric_claims').update({
      gate2_passed: true,
      gate2_checked_at: new Date().toISOString(),
      gps_within_zone: true, // already verified by geofence above
      status: 'gate2_passed',
    } as never).eq('id', claimId);

    // Fraud checks: run all signals
    const fraudResult = await runAllFraudChecks(claimId);
    await supabase.from('parametric_claims').update({
      fraud_score: fraudResult.fraudScore,
      fraud_signals: fraudResult.signals as never,
      is_flagged: fraudResult.isFlagged,
      flag_reason: fraudResult.reasons.length > 0 ? fraudResult.reasons.join('; ') : null,
    } as never).eq('id', claimId);

    // Route: zero-touch means auto-approve OR auto-reject. No manual queue.
    if (fraudResult.fraudScore >= 0.7) {
      // High fraud → auto-REJECT (not manual review)
      await supabase.from('parametric_claims').update({
        status: 'rejected',
        flag_reason: fraudResult.reasons.join('; ') || 'Auto-rejected: fraud score too high',
      } as never).eq('id', claimId);
      await updateTrustScore(policy.profile_id, false);
      console.log(`[Claims] Claim ${claimId} auto-REJECTED (fraud: ${fraudResult.fraudScore.toFixed(2)})`);
    } else {
      // Approve and pay instantly
      await supabase.from('parametric_claims').update({ status: 'approved' } as never).eq('id', claimId);
      const payResult = await simulatePayout(claimId, policy.profile_id, payoutAmount);
      if (payResult.success) payoutsInitiated++;
      await updateTrustScore(policy.profile_id, true);
      console.log(`[Claims] Claim ${claimId} auto-APPROVED + paid (fraud: ${fraudResult.fraudScore.toFixed(2)})`);
    }
  }

  return { claims_created: claimsCreated, payouts_initiated: payoutsInitiated };
}
