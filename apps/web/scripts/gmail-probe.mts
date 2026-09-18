/**
 * Diagnostic: what rate does Gmail actually sustain for this project?
 * Fetches messages at fixed rates, reports where 403s start and how fast it recovers.
 */
import { devContext } from './_dev';

const { user } = await devContext('gmail:probe');
const { getSourceAccessToken } = await import('../lib/sources/tokens');
const { listMessageIds, MAIL_QUERY_BASE, MESSAGE_FIELDS } = await import('../lib/sources/gmail');

const token = await getSourceAccessToken(user.id, 'mail');
const ids = await listMessageIds(token, `newer_than:90d ${MAIL_QUERY_BASE}`, 1200);
console.log(`listed ${ids.length} ids over 90 days\n`);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One raw fetch. Returns 'ok', 'limited' (403 quota) or another status. */
async function get(id: string): Promise<'ok' | 'limited' | string> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full&fields=${encodeURIComponent(MESSAGE_FIELDS)}`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (res.ok) return 'ok';
  const body = await res.text().catch(() => '');
  if (res.status === 403 && /rateLimitExceeded|Quota exceeded/i.test(body)) return 'limited';
  return `${res.status}`;
}

let cursor = 0;
const next = () => ids[cursor++ % ids.length]!;

/** Fire `rate` requests per second for `seconds`, without waiting for the previous second. */
async function phase(rate: number, seconds: number) {
  const started = Date.now();
  const results: Promise<string>[] = [];
  for (let s = 0; s < seconds; s++) {
    for (let i = 0; i < rate; i++) results.push(get(next()));
    await sleep(1000);
  }
  const settled = await Promise.all(results);
  const ok = settled.filter((r) => r === 'ok').length;
  const limited = settled.filter((r) => r === 'limited').length;
  const other = settled.filter((r) => r !== 'ok' && r !== 'limited');
  const elapsed = (Date.now() - started) / 1000;
  console.log(
    `${String(rate).padStart(2)} msg/s for ${seconds}s → ok ${ok}, limited ${limited}${other.length ? `, other ${other.join(',')}` : ''} · ` +
      `sustained ${(ok / elapsed).toFixed(1)} msg/s = ${((ok / elapsed) * 5 * 60).toFixed(0)} units/min`,
  );
  return limited;
}

/** After a wall of 403s, how long until a single request works again? */
async function recovery() {
  const started = Date.now();
  for (let i = 0; i < 90; i++) {
    if ((await get(next())) === 'ok') return (Date.now() - started) / 1000;
    await sleep(2000);
  }
  return Infinity;
}

for (const rate of [5, 10, 20, 40]) {
  const limited = await phase(rate, 10);
  if (limited > 0) {
    const seconds = await recovery();
    console.log(`   recovered after ${seconds.toFixed(0)}s of quiet`);
  }
  await sleep(60_000);
}
console.log('\ndone');
