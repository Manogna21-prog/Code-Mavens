// ============================================================================
// Adjudicator Claims — Match policies to events, create claims
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { isWithinCircle } from '@/lib/utils/geo';
import { CLAIM_RULES } from '@/lib/config/constants';
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
  const payoutsInitiated = 0;

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
    const { error: claimError } = await supabase
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
      } as never);

    if (claimError) {
      console.error('[Claims] Error creating claim:', claimError);
      continue;
    }

    claimsCreated++;
  }

  return { claims_created: claimsCreated, payouts_initiated: payoutsInitiated };
}
