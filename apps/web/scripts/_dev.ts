/**
 * Shared bootstrap for dev-only scripts: refuses production, loads apps/web/.env.local, resolves the target user.
 * Usage in a script: `const { repo, user } = await devContext();` — pass `--user <id>` or `--email <address>`,
 * or omit both when the database has exactly one onboarded user.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { User } from '@morrow/core';

export function refuseProduction(script: string) {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
    console.error(`${script} is a development tool and refuses to run with NODE_ENV=production.`);
    process.exit(1);
  }
}

export function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

export async function devContext(script: string) {
  refuseProduction(script);
  const envFile = join(dirname(fileURLToPath(import.meta.url)), '..', '.env.local');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set (apps/web/.env.local).');

  const { getRepository } = await import('../lib/data');
  const { getDb } = await import('../lib/db/client');
  const { users } = await import('../lib/db/schema');
  const { eq, isNotNull } = await import('drizzle-orm');
  const repo = getRepository();

  const userId = arg('user');
  const email = arg('email');
  let id: string;
  if (userId) id = userId;
  else if (email) {
    const [row] = await getDb().select({ id: users.id }).from(users).where(eq(users.email, email));
    if (!row) throw new Error('No user with that email.');
    id = row.id;
  } else {
    const rows = await getDb().select({ id: users.id }).from(users).where(isNotNull(users.onboardedAt));
    if (rows.length !== 1) throw new Error(`Found ${rows.length} onboarded users — pass --user <id> or --email <address>.`);
    id = rows[0]!.id;
  }
  const user: User | null = await repo.getUser(id);
  if (!user) throw new Error('User not found.');
  return { repo, user };
}
