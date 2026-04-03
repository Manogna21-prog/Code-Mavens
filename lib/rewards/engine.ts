// ============================================================================
// Rewards & Coins Engine
// Award coins for driver engagement activities
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { COINS } from '@/lib/config/constants';

/**
 * Award coins to a driver profile
 */
export async function awardCoins(
  profileId: string,
  activity: string,
  coins: number,
  description: string,
  referenceId?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('coins_ledger')
    .insert({
      profile_id: profileId,
      activity,
      coins,
      description,
      reference_id: referenceId ?? null,
    } as never);

  if (error) {
    console.error('[Rewards] Error awarding coins:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Award weekly login bonus if not already awarded this week
 */
export async function checkAndAwardWeeklyLogin(
  profileId: string
): Promise<{ awarded: boolean }> {
  const supabase = createAdminClient();

  // Calculate current week start (Monday)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);

  // Check if already awarded this week
  const { count } = await supabase
    .from('coins_ledger')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .eq('activity', 'weekly_login')
    .gte('created_at', weekStart.toISOString());

  if ((count ?? 0) > 0) {
    return { awarded: false };
  }

  await awardCoins(
    profileId,
    'weekly_login',
    COINS.WEEKLY_LOGIN,
    'Weekly login bonus'
  );

  return { awarded: true };
}

/**
 * Check if driver has 4 consecutive active weeks and award bonus
 */
export async function checkAndAwardConsecutiveWeeks(
  profileId: string
): Promise<{ awarded: boolean }> {
  const supabase = createAdminClient();

  // Check last 4 weeks for weekly_login entries
  const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();

  const { data: loginsRaw } = await supabase
    .from('coins_ledger')
    .select('created_at')
    .eq('profile_id', profileId)
    .eq('activity', 'weekly_login')
    .gte('created_at', fourWeeksAgo)
    .order('created_at', { ascending: true });

  const logins = (loginsRaw ?? []) as unknown as Array<{ created_at: string }>;

  // Group by ISO week
  const weeks = new Set<string>();
  for (const login of logins) {
    const date = new Date(login.created_at);
    const weekNumber = getISOWeek(date);
    const year = date.getFullYear();
    weeks.add(`${year}-W${weekNumber}`);
  }

  if (weeks.size < 4) {
    return { awarded: false };
  }

  // Check if consecutive_weeks bonus already awarded recently
  const { count } = await supabase
    .from('coins_ledger')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .eq('activity', 'consecutive_weeks')
    .gte('created_at', fourWeeksAgo);

  if ((count ?? 0) > 0) {
    return { awarded: false };
  }

  await awardCoins(
    profileId,
    'consecutive_weeks',
    COINS.CONSECUTIVE_WEEKS_4,
    '4 consecutive active weeks bonus'
  );

  return { awarded: true };
}

/**
 * Award disruption active bonus when driver is active during an event
 */
export async function awardDisruptionActive(
  profileId: string,
  claimId: string
): Promise<{ awarded: boolean }> {
  // Avoid duplicate awards for same claim
  const supabase = createAdminClient();

  const { count } = await supabase
    .from('coins_ledger')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .eq('activity', 'disruption_active')
    .eq('reference_id', claimId);

  if ((count ?? 0) > 0) {
    return { awarded: false };
  }

  await awardCoins(
    profileId,
    'disruption_active',
    COINS.DISRUPTION_ACTIVE,
    'Active during disruption event',
    claimId
  );

  return { awarded: true };
}

/**
 * Award referral bonus to the referrer
 */
export async function awardReferral(
  referrerId: string,
  refereeId: string
): Promise<{ awarded: boolean }> {
  // Avoid duplicate referral awards
  const supabase = createAdminClient();

  const { count } = await supabase
    .from('coins_ledger')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', referrerId)
    .eq('activity', 'referral')
    .eq('reference_id', refereeId);

  if ((count ?? 0) > 0) {
    return { awarded: false };
  }

  await awardCoins(
    referrerId,
    'referral',
    COINS.REFERRAL,
    'Referral bonus',
    refereeId
  );

  return { awarded: true };
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
