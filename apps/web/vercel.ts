import type { VercelConfig } from '@vercel/config/v1';

/**
 * Vercel project config (project root: apps/web).
 * Cron requests carry `Authorization: Bearer $CRON_SECRET`.
 * Hobby plan: crons run at most once a day (and anywhere within the hour), so the jobs are daily and the app also
 * syncs stale sources when someone opens Today (`lib/jobs/sync-on-visit.ts`); readings are drawn lazily on visit.
 */
export const config: VercelConfig = {
  framework: 'nextjs',
  crons: [
    // Daily at 10:50 UTC (early morning in the Americas): sync connected sources and purge expired raw events.
    { path: '/api/cron/sync', schedule: '50 10 * * *' },
    // Daily at 11:00 UTC: seal yesterday and draw today's readings ahead of the first visit.
    { path: '/api/cron/dawn', schedule: '0 11 * * *' },
    // Daily at 23:00 UTC: verify open prophecies against newly synced events.
    { path: '/api/cron/verify', schedule: '0 23 * * *' },
  ],
};
