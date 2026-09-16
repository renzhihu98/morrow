import type { Repository } from '../data';
import { syncUser } from '../sources/sync';

/** Leave headroom under the 300 s function limit; remaining users are picked up next hour. */
const BUDGET_MS = 240_000;

export async function runSync(repo: Repository, now: Date) {
  const started = Date.now();
  const users = [];
  let skipped = 0;
  if (repo.kind === 'drizzle') {
    for (const user of await repo.listUsers()) {
      if (Date.now() - started > BUDGET_MS) {
        skipped++;
        continue;
      }
      const results = await syncUser(repo, user, now);
      if (results.length > 0) users.push({ userId: user.id, results });
    }
  }
  const purgedRawEvents = await repo.purgeExpiredRawEvents(now);
  return { users, skipped, purgedRawEvents };
}
