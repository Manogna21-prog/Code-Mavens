// ============================================================================
// POST /api/payments/verify — Verify Razorpay payment signature
// On success: create weekly_policy, mark onboarding complete
// ============================================================================

import { NextResponse } from 'next/server';
import { parseBody, errorResponse, successResponse } from '@/lib/utils/api';
import { getSession } from '@/lib/utils/auth';
import { verifyPaymentSchema } from '@/lib/validations/schemas';
import { createAdminClient } from '@/lib/supabase/admin';
import { razorpayKeySecret } from '@/lib/config/env';
import { getWeekStart, getWeekEnd, formatDate } from '@/lib/utils/date';
import { validatePaymentVerification } from 'razorpay/dist/utils/razorpay-utils';
import type { PlanPackageRow } from '@/lib/types/database';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await parseBody(request, verifyPaymentSchema);
    const profileId = session.user.id;

    // Verify the Razorpay signature
    const isValid = validatePaymentVerification(
      {
        order_id: body.razorpay_order_id,
        payment_id: body.razorpay_payment_id,
      },
      body.razorpay_signature,
      razorpayKeySecret()
    );

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Update payment_transaction
    const { error: txError } = await supabase
      .from('payment_transactions')
      .update({
        razorpay_payment_id: body.razorpay_payment_id,
        razorpay_signature: body.razorpay_signature,
        status: 'paid',
        updated_at: new Date().toISOString(),
      } as never)
      .eq('razorpay_order_id', body.razorpay_order_id)
      .eq('profile_id', profileId);

    if (txError) {
      console.error('[VerifyPayment] Error updating transaction:', txError);
      throw new Error('Failed to update payment transaction');
    }

    // Look up the plan
    const { data: planRaw, error: planError } = await supabase
      .from('plan_packages')
      .select('*')
      .eq('id', body.plan_id)
      .single();

    if (planError || !planRaw) {
      throw new Error('Plan not found');
    }

    const plan = planRaw as unknown as PlanPackageRow;

    // Create weekly_policy for this week (Mon-Sun)
    const weekStart = getWeekStart();
    const weekEnd = getWeekEnd();

    const { data: policyRaw, error: policyError } = await supabase
      .from('weekly_policies')
      .insert({
        profile_id: profileId,
        plan_id: body.plan_id,
        week_start_date: formatDate(weekStart),
        week_end_date: formatDate(weekEnd),
        base_premium_inr: plan.weekly_premium_inr,
        weather_risk_addon: 0,
        ubi_addon: 0,
        final_premium_inr: plan.weekly_premium_inr,
        is_active: true,
        payment_status: 'paid',
        razorpay_order_id: body.razorpay_order_id,
        razorpay_payment_id: body.razorpay_payment_id,
        total_payout_this_week: 0,
      } as never)
      .select('id')
      .single();

    if (policyError) {
      console.error('[VerifyPayment] Error creating weekly_policy:', policyError);
      throw new Error('Failed to create weekly policy');
    }

    const policy = policyRaw as unknown as { id: string };

    // Link the policy to the payment transaction
    await supabase
      .from('payment_transactions')
      .update({ policy_id: policy.id } as never)
      .eq('razorpay_order_id', body.razorpay_order_id)
      .eq('profile_id', profileId);

    // Mark onboarding complete
    await supabase
      .from('profiles')
      .update({
        onboarding_status: 'complete',
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', profileId);

    return successResponse({
      success: true,
      policy_id: policy.id,
      week_start: formatDate(weekStart),
      week_end: formatDate(weekEnd),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
