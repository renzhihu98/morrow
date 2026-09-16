import { authed, toCoreUser } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { now as serverNow } from '@/lib/server/env';
import { getTodayView } from '@/lib/server/readings';
import { rebuildDossier } from '@/lib/dossier/build';
import { syncUser } from '@/lib/sources/sync';

export const maxDuration = 300;

const FRESH_MS = 10 * 60_000;

/**
 * POST /api/onboarding/complete — "Draw my first reading" (or "Skip for now"): marks onboardedAt, runs the
 * initial sync + dossier build, creates today's reading with its opening, and returns `TodayResponse`.
 */
export const POST = authed(async (sessionUser) => {
  const repo = getRepository();
  const user = toCoreUser(sessionUser);
  const now = serverNow();
  await repo.markOnboarded(user.id, now.toISOString());
  if (repo.kind === 'drizzle') {
    // Sources synced moments ago by the on-connect hook don't need a second pass.
    const stale = (await repo.listSources(user.id))
      .filter((s) => s.status !== 'not_linked' && (!s.lastSyncedAt || now.getTime() - Date.parse(s.lastSyncedAt) > FRESH_MS))
      .map((s) => s.kind);
    if (stale.length > 0) await syncUser(repo, user, now, { kinds: stale });
    if (!(await repo.getDossier(user.id))) await rebuildDossier(repo, user, now);
  }
  return Response.json(await getTodayView(repo, user, now));
});
