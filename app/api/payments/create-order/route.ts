// ============================================================================
// POST /api/payments/create-order — Create a Razorpay order for premium
// ============================================================================

import { NextResponse } from 'next/server';
import { parseBody, errorResponse, successResponse } from '@/lib/utils/api';
import { getSession } from '@/lib/utils/auth';
import { createOrderSchema } from '@/lib/validations/schemas';
import { createOrder } from '@/lib/payments/create-order';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await parseBody(request, createOrderSchema);

    const result = await createOrder({
      profileId: session.user.id,
      planId: body.plan_id,
    });

    return successResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
