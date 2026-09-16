import { getLocalParts, getReadingDate, DAY_CUTOFF_HOUR } from '@morrow/core';
import type { Repository } from '../data';
import { ensureTodayReading, sealStaleReadings } from '../server/readings';

/**
 * Dawn job — runs hourly; each user is processed when their local day has turned over
 * (their local hour is DAY_CUTOFF_HOUR) or their reading for today doesn't exist yet.
 * seal → summarize → create → open (from the dossier maintained by the sync cron).
 */
export async function runDawn(repo: Repository, now: Date) {
  const results = [];
  for (const user of await repo.listUsers()) {
    const localDate = getReadingDate(now, user.timezone);
    const existing = await repo.getReadingByDate(user.id, localDate);
    const atDawn = getLocalParts(now, user.timezone).hour === DAY_CUTOFF_HOUR;
    if (existing && !atDawn) {
      results.push({ userId: user.id, localDate, action: 'skipped' as const });
      continue;
    }
    const sealed = await sealStaleReadings(repo, user, now);
    // The dossier is kept fresh by /api/cron/sync (hourly) — dawn reads it as is.
    const reading = await ensureTodayReading(repo, user, now);
    results.push({
      userId: user.id,
      localDate,
      action: existing ? ('sealed' as const) : ('opened' as const),
      sealed: sealed.map((r) => r.id),
      readingId: reading.id,
    });
  }
  return { users: results };
}
