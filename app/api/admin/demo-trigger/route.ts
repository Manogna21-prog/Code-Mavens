import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerClient } from '@/lib/supabase/server';
import { demoTriggerSchema } from '@/lib/validations/schemas';
import { getCityBySlug } from '@/lib/config/cities';
import { TRIGGERS } from '@/lib/config/constants';
import { setMockPlatformStatus } from '@/lib/clients/statusgator';
import { processClaimsForEvent } from '@/lib/adjudicator/claims';
import { simulatePayout } from '@/lib/payments/simulate-payout';
import type { DisruptionType } from '@/lib/config/constants';
import type { TriggerCandidate } from '@/lib/adjudicator/types';

export async function POST(request: Request) {
  try {
    // Auth check — get user ID if available (no role restriction for hackathon demo)
    let userId: string | null = null;
    try {
      const supabase = await createServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id ?? null;
    } catch {
      // Server client may fail if cookies aren't available
    }

    const admin = createAdminClient();

    const body = await request.json();
    const { city, event_type, severity, trigger_value } = demoTriggerSchema.parse(body);

    const cityData = getCityBySlug(city);
    if (!cityData) {
      return NextResponse.json({ error: 'Unknown city' }, { status: 400 });
    }

    const triggerConfig = TRIGGERS[event_type as DisruptionType];
    const actualTriggerValue = trigger_value ?? triggerConfig.threshold * 1.5;

    if (event_type === 'platform_outage') {
      setMockPlatformStatus('down', actualTriggerValue);
    }

    // Insert disruption event
    const { data: event, error } = await admin
      .from('live_disruption_events')
      .insert({
        event_type,
        severity_score: severity,
        city,
        zone_latitude: cityData.latitude,
        zone_longitude: cityData.longitude,
        geofence_radius_km: triggerConfig.geofence_radius_km,
        trigger_value: actualTriggerValue,
        trigger_threshold: triggerConfig.threshold,
        verified_by_api: true,
        raw_api_data: { demo: true, injected_by: userId || 'admin' } as unknown as null,
        data_sources: ['demo-panel'],
        rule_version: 'demo',
      } as never)
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const evt = event as { id: string } | null;
    if (!evt?.id) {
      return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
    }

    // Also process claims for affected policies (like the adjudicator would)
    const candidate: TriggerCandidate = {
      event_type: event_type as DisruptionType,
      city,
      latitude: cityData.latitude,
      longitude: cityData.longitude,
      severity_score: severity,
      trigger_value: actualTriggerValue,
      trigger_threshold: triggerConfig.threshold,
      geofence_radius_km: triggerConfig.geofence_radius_km,
      data_sources: ['demo-panel'],
      raw_api_data: { demo: true },
      verified_by_api: true,
      verified_by_llm: false,
    };

    const claimResult = await processClaimsForEvent(evt.id, candidate);

    // Auto-payout all claims created by demo trigger
    let payoutsCompleted = 0;
    if (claimResult.claims_created > 0) {
      const { data: newClaims } = await admin
        .from('parametric_claims')
        .select('id, profile_id, payout_amount_inr')
        .eq('disruption_event_id', evt.id)
        .eq('status', 'gate1_passed');

      type ClaimRow = { id: string; profile_id: string; payout_amount_inr: number };
      const claims = (newClaims as unknown as ClaimRow[]) || [];

      for (const claim of claims) {
        const result = await simulatePayout(claim.id, claim.profile_id, claim.payout_amount_inr);
        if (result.success) payoutsCompleted++;
      }
    }

    return NextResponse.json({
      status: 'ok',
      event_id: evt.id,
      claims_created: claimResult.claims_created,
      payouts_completed: payoutsCompleted,
      message: `Demo ${event_type} trigger injected for ${city}. ${claimResult.claims_created} claim(s) created, ${payoutsCompleted} payout(s) completed.`,
    });
  } catch (error) {
    console.error('[Admin] Demo trigger error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}
