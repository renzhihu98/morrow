/**
 * Dev only: `pnpm --filter @morrow/web chat:reset [--user <id> | --email <address>]`
 * Deletes the user's readings, messages and prophecies (account, sources and dossier stay), so the next visit
 * draws a fresh reading.
 */
import { and, eq } from 'drizzle-orm';
import { devContext } from './_dev';

const { user } = await devContext('chat:reset');
const { getDb } = await import('../lib/db/client');
const { messages, prophecies, readings } = await import('../lib/db/schema');
const db = getDb();
const m = await db.delete(messages).where(eq(messages.userId, user.id)).returning({ id: messages.id });
const p = await db.delete(prophecies).where(and(eq(prophecies.userId, user.id))).returning({ id: prophecies.id });
const r = await db.delete(readings).where(eq(readings.userId, user.id)).returning({ id: readings.id });
console.log(`cleared ${r.length} readings, ${m.length} messages, ${p.length} prophecies`);
