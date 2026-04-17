// ============================================================================
// Date Utilities — IST helpers, week boundaries
// ============================================================================

/**
 * Get current date in IST
 */
export function nowIST(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
}

/**
 * Get Monday of the current week (IST)
 */
export function getWeekStart(date?: Date): Date {
  const d = date ? new Date(date) : nowIST();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Get Sunday of the current week (IST)
 */
export function getWeekEnd(date?: Date): Date {
  const monday = getWeekStart(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Check if today is within the given week
 */
export function isWithinWeek(weekStart: string, weekEnd: string): boolean {
  const now = nowIST();
  const start = new Date(weekStart);
  const end = new Date(weekEnd);
  end.setHours(23, 59, 59, 999);
  return now >= start && now <= end;
}

/**
 * Get start of today in IST as ISO string
 */
export function todayStartIST(): string {
  const now = nowIST();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

/**
 * Get next Monday from a given date
 */
export function getNextMonday(date?: Date): Date {
  const d = date ? new Date(date) : nowIST();
  const day = d.getDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  const nextMonday = new Date(d);
  nextMonday.setDate(d.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);
  return nextMonday;
}

/**
 * Check if current time is within Sunday payment window (6:00 AM - 11:59 PM IST)
 */
export function isSundayPaymentWindow(): boolean {
  const ist = nowIST();
  const day = ist.getDay(); // 0 = Sunday
  if (day !== 0) return false;
  const hour = ist.getHours();
  return hour >= 6; // 6 AM to 11:59 PM
}

/**
 * Get the next Sunday date (for showing renewal window date)
 */
export function getNextSunday(date?: Date): Date {
  const d = date ? new Date(date) : nowIST();
  const day = d.getDay();
  const daysUntilSunday = day === 0 ? 7 : 7 - day;
  const nextSun = new Date(d);
  nextSun.setDate(d.getDate() + daysUntilSunday);
  nextSun.setHours(6, 0, 0, 0);
  return nextSun;
}

/**
 * Get the Sunday end of next week (for next week's policy end date)
 */
export function getNextWeekEnd(date?: Date): Date {
  const nextMon = getNextMonday(date);
  const sun = new Date(nextMon);
  sun.setDate(nextMon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return sun;
}
