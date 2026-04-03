// ============================================================================
// Auth Utilities — Session extraction helpers
// ============================================================================

import { createServerClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types/database';

/**
 * Get current user's session from server component/route
 */
export async function getSession() {
  const supabase = await createServerClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) return null;
  return session;
}

/**
 * Get current user's profile
 */
export async function getProfile(): Promise<Profile | null> {
  const session = await getSession();
  if (!session) return null;

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (error || !data) return null;
  return data as Profile;
}

/**
 * Require authentication — throws redirect if not authenticated
 */
export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    throw new Error('UNAUTHORIZED');
  }
  return session;
}
