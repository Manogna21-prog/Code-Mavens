import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { computeFraudScore, type FraudSignalsInput } from '@/lib/fraud/scoring';
import { FRAUD } from '@/lib/config/constants';

// Purely synthetic: admin supplies signal inputs, we run the same scoring
// function the live detector uses and return the breakdown for display.
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as Partial<FraudSignalsInput>;

    const input: FraudSignalsInput = {
      trust_history: {
        trustScore: num(body.trust_history?.trustScore, FRAUD.TRUST_SCORE_DEFAULT),
        priorFlaggedCount: int(body.trust_history?.priorFlaggedCount, 0),
        confirmedFraudCount: int(body.trust_history?.confirmedFraudCount, 0),
        tenureMonths: num(body.trust_history?.tenureMonths, 0),
      },
      location_anomaly: {
        gpsToIpDistanceKm:
          body.location_anomaly?.gpsToIpDistanceKm == null
            ? null
            : Number(body.location_anomaly.gpsToIpDistanceKm),
        impossibleTravel: Boolean(body.location_anomaly?.impossibleTravel),
      },
      cluster: {
        claimCountInWindow: int(body.cluster?.claimCountInWindow, 0),
        uniqueDevices: int(body.cluster?.uniqueDevices, 0),
        sharedIpsAcrossProfiles: int(body.cluster?.sharedIpsAcrossProfiles, 0),
        lowGpsEntropy: Boolean(body.cluster?.lowGpsEntropy),
      },
    };

    const result = computeFraudScore(input);

    return NextResponse.json({
      input,
      score: result.score,
      decision: result.decision,
      contributions: result.contributions,
      thresholds: {
        auto_approve: FRAUD.AUTO_APPROVE_THRESHOLD,
        manual_review: FRAUD.MANUAL_REVIEW_THRESHOLD,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function int(v: unknown, fallback: number): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? n : fallback;
}
