import type { User } from '@morrow/core';
import type { Repository } from '../data';

/** Short-lived cookie the sign-in page sets with the browser zone, read when Better Auth creates the user. */
export const TZ_COOKIE = 'morrow_tz';
export const TZ_COOKIE_MAX_AGE_S = 600;

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || tz.length === 0 || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The zone from a `Cookie` header, if present and valid. */
export function timezoneFromCookieHeader(header: string | null | undefined): string | null {
  const match = header?.match(new RegExp(`(?:^|;\\s*)${TZ_COOKIE}=([^;]+)`));
  if (!match) return null;
  let value: string;
  try {
    value = decodeURIComponent(match[1]!);
  } catch {
    return null;
  }
  return isValidTimeZone(value) ? value : null;
}

/**
 * Stores the person's zone. Facts are derived in the person's timezone at build time (aggregates hold instants),
 * so when the zone actually changes the dossier is rebuilt right away. Returns whether it changed.
 */
export async function applyTimezone(repo: Repository, user: User, timezone: string, now: Date): Promise<boolean> {
  await repo.setUserTimezone(user.id, timezone);
  if (user.timezone === timezone) return false;
  if (!(await repo.getDossier(user.id))) return true;
  // Loaded lazily: this module is also imported by the Better Auth config.
  const { rebuildDossier } = await import('../dossier/build');
  await rebuildDossier(repo, { ...user, timezone }, now);
  return true;
}
