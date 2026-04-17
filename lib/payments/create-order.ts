// ============================================================================
// Create Razorpay Order — Premium payment for a plan
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { getRazorpayClient } from '@/lib/payments/razorpay';
import type { PlanPackageRow } from '@/lib/types/database';

interface CreateOrderInput {
  profileId: string;
  planId: string;
}

interface CreateOrderResult {
  orderId: string;
  amount: number;
  currency: string;
  planName: string;
}

/**
 * Create a Razorpay order for the given profile and plan.
 * Inserts a payment_transaction record in the database.
 */
export async function createOrder({ profileId, planId }: CreateOrderInput): Promise<CreateOrderResult> {
  const supabase = createAdminClient();

  // Look up the plan
  const { data: planRaw, error: planError } = await supabase
    .from('plan_packages')
    .select('*')
    .eq('id', planId)
    .single();

  if (planError || !planRaw) {
    throw new Error('Plan not found');
  }

  const plan = planRaw as unknown as PlanPackageRow;

  // Amount in paise (Razorpay uses smallest currency unit)
  const amountPaise = plan.weekly_premium_inr * 100;

  // Create Razorpay order
  const razorpay = getRazorpayClient();
  const order = await razorpay.orders.create({
    amount: amountPaise,
    currency: 'INR',
    receipt: `ss_${profileId.slice(0, 8)}_${Date.now().toString(36)}`,
    notes: {
      profile_id: profileId,
      plan_id: planId,
      plan_name: plan.name,
    },
  });

  // Insert payment_transaction record
  const { error: txError } = await supabase
    .from('payment_transactions')
    .insert({
      profile_id: profileId,
      razorpay_order_id: order.id,
      amount_inr: plan.weekly_premium_inr,
      status: 'created',
      metadata: { plan_id: planId, plan_name: plan.name },
    } as never);

  if (txError) {
    console.error('[CreateOrder] Error inserting payment_transaction:', txError);
    throw new Error('Failed to record payment transaction');
  }

  return {
    orderId: order.id,
    amount: amountPaise,
    currency: 'INR',
    planName: plan.name,
  };
}
