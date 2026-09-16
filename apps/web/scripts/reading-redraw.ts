/**
 * Dev only: `pnpm --filter @morrow/web reading:redraw [--user <id> | --email <address>]`
 * Deletes today's reading for a user (its messages and the prophecies made in it) and draws it again through the
 * normal code path (`openReading`: dossier → Sonnet 5 → grounding + quality gate → templated fallback).
 */
import { getReadingDate } from '@morrow/core';
import { devContext } from './_dev';

const { repo, user } = await devContext('reading:redraw');
const { and, eq } = await import('drizzle-orm');
const { getDb } = await import('../lib/db/client');
const { messages, prophecies, readings } = await import('../lib/db/schema');
const { openReading, readingIdFor } = await import('../lib/server/readings');

const now = new Date();
const localDate = getReadingDate(now, user.timezone);
const readingId = readingIdFor(localDate);
const db = getDb();

const deletedProphecies = await db
  .delete(prophecies)
  .where(and(eq(prophecies.userId, user.id), eq(prophecies.madeInReadingId, readingId), eq(prophecies.status, 'open')))
  .returning({ id: prophecies.id });
const deletedMessages = await db
  .delete(messages)
  .where(and(eq(messages.userId, user.id), eq(messages.readingId, readingId)))
  .returning({ id: messages.id });
await db.delete(readings).where(and(eq(readings.userId, user.id), eq(readings.id, readingId)));
console.log(`Deleted reading ${localDate} (${deletedMessages.length} messages, ${deletedProphecies.length} prophecies).`);

const started = Date.now();
const reading = await openReading(repo, user, localDate, now);
const [opening] = await repo.listMessages(user.id, reading.id);
const prophecy = (await repo.listProphecies(user.id)).find((p) => p.id === reading.prophecyId);
const observation = opening?.parts.find((p) => p.type === 'observation');

console.log(`\nRedrew ${localDate} (${user.timezone}) in ${((Date.now() - started) / 1000).toFixed(1)} s`);
if (observation?.type === 'observation') {
  console.log(`observation: ${observation.text}`);
  console.log(`evidence:    ${observation.evidenceRef}`);
}
if (prophecy) {
  console.log(`prophecy:    ${prophecy.statement}`);
  console.log(`check:       ${JSON.stringify(prophecy.checkCondition)}`);
  console.log(`window:      ${Math.round((Date.parse(prophecy.windowEnd) - Date.parse(prophecy.windowStart)) / 86_400_000)} days · likelihood ${prophecy.likelihood} · watching ${prophecy.watching.join(', ')}`);
}
