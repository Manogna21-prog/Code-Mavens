import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { reviewClaimSchema } from '@/lib/validations/schemas';

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient();
    const { data: profileData } = await admin.from('profiles').select('id, role').eq('id', user.id).single();
    const profile = profileData as { id: string; role: string } | null;
    if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { claim_id, action, reason } = reviewClaimSchema.parse(body);

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const { error } = await admin
      .from('parametric_claims')
      .update({
        status: newStatus,
        admin_review_status: action === 'approve' ? 'approved' : 'rejected',
        reviewed_by: profile.id,
        reviewed_at: new Date().toISOString(),
        flag_reason: action === 'reject' && reason ? reason : undefined,
      } as never)
      .eq('id', claim_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      status: 'ok',
      claim_id,
      action,
      message: `Claim ${action}d successfully`,
    });
  } catch (error) {
    console.error('[Admin] Review claim error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to review claim' },
      { status: 500 },
    );
  }
}
