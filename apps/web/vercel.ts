import type { VercelConfig } from '@vercel/config/v1';

/**
 * Vercel project config (project root: apps/web).
 * Cron requests carry `Authorization: Bearer $CRON_SECRET`.
 */
export const config: VercelConfig = {
  framework: 'nextjs',
  crons: [
    // Hourly: each user's reading turns over at 04:00 in *their* timezone, so the job checks every hour.
    { path: '/api/cron/dawn', schedule: '0 * * * *' },
    // Every 30 minutes: verify open prophecies against newly synced events.
    { path: '/api/cron/verify', schedule: '*/30 * * * *' },
  ],
};
