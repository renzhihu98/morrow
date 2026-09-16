import { FIXTURE_NOW } from '@morrow/core';

/** Postgres is used when DATABASE_URL is set; otherwise the in-memory fixture repository. */
export const hasDatabase = (): boolean => Boolean(process.env.DATABASE_URL);

/** A model is reachable through AI Gateway with an API key or a Vercel OIDC token. */
export const hasModelAccess = (): boolean =>
  Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);

/** Demo data mode: no database → fixtures, and the clock starts at FIXTURE_NOW. */
export const isDemoData = (): boolean => !hasDatabase();

const g = globalThis as typeof globalThis & { __morrowBoot?: number };
g.__morrowBoot ??= Date.now();

/**
 * Server "now". In demo data mode the clock starts at FIXTURE_NOW (09.30 09:12 in LA) when the
 * server boots and then advances in real time, so timestamps on new messages look natural.
 */
export function now(): Date {
  if (!isDemoData()) return new Date();
  return new Date(FIXTURE_NOW.getTime() + (Date.now() - (g.__morrowBoot ?? Date.now())));
}
