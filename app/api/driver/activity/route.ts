// ============================================================================
// POST /api/driver/activity — Log driver activity (status + GPS)
// ============================================================================

import { NextResponse } from 'next/server';
import { parseBody, errorResponse, successResponse } from '@/lib/utils/api';
import { getSession } from '@/lib/utils/auth';
import { activityLogSchema } from '@/lib/validations/schemas';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await parseBody(request, activityLogSchema);

    const supabase = createAdminClient();

    // Extract IP address from request headers
    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress = forwarded?.split(',')[0]?.trim() ?? null;

    const { error } = await supabase
      .from('driver_activity_logs')
      .insert({
        profile_id: session.user.id,
        status: body.status,
        latitude: body.latitude,
        longitude: body.longitude,
        ip_address: ipAddress,
        recorded_at: new Date().toISOString(),
      } as never);

    if (error) {
      console.error('[Activity] Error inserting log:', error);
      return NextResponse.json({ error: 'Failed to log activity' }, { status: 500 });
    }

    return successResponse({ success: true, recorded_at: new Date().toISOString() });
  } catch (error) {
    return errorResponse(error);
  }
}
