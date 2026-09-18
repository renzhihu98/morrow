/**
 * Gmail (read-only, `gmail.readonly`). SPEC §12.3: messages from the last 90 days outside Promotions, Social,
 * Forums, Spam and Trash. Only the fields below are requested; bodies are reduced to plain text without quoted
 * replies and trimmed, kept in raw_events (24h) just long enough to be turned into thread notes.
 */
import { contactKey } from './google-calendar';
import { getJson, SourceSyncError, type FetchLike } from './errors';
import type { EmailPayload, MailPerson } from './types';

export const MAIL_PAST_DAYS = 14;
/**
 * Messages read per sync. Measured throughput is ~1.5 messages/s, and a Vercel function stops at 300 s, so the first
 * sync is sized to finish in about two minutes; later syncs only pick up what is new.
 */
export const MAIL_FIRST_SYNC_MAX = 180;
export const MAIL_INCREMENTAL_MAX = 300;
export const BODY_MAX = 2000;
const LIST_PAGE = 500;
/**
 * Gmail's quota refills slower than its per-minute number suggests: bursts of ~100 messages run clean (`pnpm
 * gmail:probe`), then the bucket empties and refills at a rate this project can't read anywhere. So the pace is not
 * a constant but found at run time — start optimistic, halve on every refusal, creep back up while it holds.
 */
const GET_CONCURRENCY = 5;
const START_PER_SECOND = 10;
const MIN_PER_SECOND = 0.5;
const MAX_PER_SECOND = 10;
/** Messages fetched cleanly before trying a little faster again. */
const SPEED_UP_AFTER = 100;

export const MAIL_QUERY_BASE = '-in:spam -in:trash -in:chats -category:promotions -category:social -category:forums';
/**
 * A first sync can only afford a few hundred messages, so it takes the ones that carry signal before the ones that
 * are merely recent: mail the person answered (the strongest evidence of who matters to them), and what Gmail itself
 * marks important or starred. The rest of the budget is filled with recent mail so the picture stays representative.
 */
export const MAIL_QUERY_PRIORITY = '(in:sent OR is:important OR is:starred)';
/** Share of a first sync reserved for priority mail; the remainder is filled by recency. */
const PRIORITY_SHARE = 0.6;

const HEADERS = new Set(['from', 'to', 'cc', 'subject', 'list-unsubscribe', 'list-id', 'precedence', 'auto-submitted']);

type GPart = { mimeType?: string; headers?: { name: string; value: string }[]; body?: { data?: string }; parts?: GPart[] };
export type GmailMessage = { id: string; threadId: string; labelIds?: string[]; snippet?: string; internalDate?: string; payload?: GPart };

export const MESSAGE_FIELDS =
  'id,threadId,labelIds,snippet,internalDate,' +
  'payload(mimeType,headers(name,value),body(data),parts(mimeType,body(data),parts(mimeType,body(data),parts(mimeType,body(data)))))';

const decode = (data: string) => Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

function findPart(part: GPart | undefined, mime: string): string | null {
  if (!part) return null;
  if (part.mimeType === mime && part.body?.data) return decode(part.body.data);
  for (const child of part.parts ?? []) {
    const found = findPart(child, mime);
    if (found) return found;
  }
  return null;
}

const htmlToText = (html: string) =>
  html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

/** Plain text of what this message itself says: quoted replies, signatures' tails and blank runs removed. */
export function messageText(payload: GPart | undefined): string {
  const raw = findPart(payload, 'text/plain') ?? (() => {
    const html = findPart(payload, 'text/html');
    return html ? htmlToText(html) : '';
  })();
  const lines: string[] = [];
  for (const line of raw.replace(/\r/g, '').split('\n')) {
    const t = line.trim();
    if (/^On .{4,200}wrote:$/.test(t) || /^-{2,}\s*(Original|Forwarded) Message/i.test(t) || /^From: .+/.test(t) && lines.length > 2) break;
    if (t.startsWith('>')) continue;
    if (t === '--' || t === '-- ') break;
    lines.push(t);
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim().slice(0, BODY_MAX);
}

/** `"Sam Lee" <sam@x.co>, ops@y.com` → people. */
export function parseAddresses(value: string | undefined): { email: string; displayName: string | null }[] {
  if (!value) return [];
  const out: { email: string; displayName: string | null }[] = [];
  for (const m of value.matchAll(/(?:"?([^",<]*?)"?\s*)?<([^>\s]+@[^>\s]+)>|([^\s,<>]+@[^\s,<>]+)/g)) {
    const email = (m[2] ?? m[3] ?? '').toLowerCase();
    if (!email) continue;
    const name = m[1]?.trim() || null;
    out.push({ email, displayName: name && !name.includes('@') ? name : null });
  }
  return out;
}

const AUTOMATED_SENDER = /^(no-?reply|do-?not-?reply|notifications?|mailer-daemon|bounce|alerts?|updates?|news(letter)?|info|support|hello|team)[+.@-]/i;

/** Maps a Gmail message to the raw payload. `selfEmail` is the account's own address. */
export function toEmailPayload(message: GmailMessage, selfEmail: string): EmailPayload | null {
  const header = (name: string) => message.payload?.headers?.find((h) => h.name.toLowerCase() === name)?.value;
  const sentAt = message.internalDate ? new Date(Number(message.internalDate)).toISOString() : null;
  if (!message.id || !message.threadId || !sentAt) return null;
  const self = selfEmail.toLowerCase();
  const labels = message.labelIds ?? [];
  const from = parseAddresses(header('from'))[0] ?? null;
  const outbound = labels.includes('SENT') || from?.email === self;
  const recipients = [...parseAddresses(header('to')), ...parseAddresses(header('cc'))];

  const toPerson = (p: { email: string; displayName: string | null }): MailPerson | null => {
    const key = contactKey(p);
    return key ? { key, email: p.email, displayName: p.displayName } : null;
  };
  const others = (outbound ? recipients : from ? [from] : []).filter((p) => p.email !== self);
  const people = [...new Map(others.map(toPerson).filter((p): p is MailPerson => p !== null).map((p) => [p.key, p])).values()];

  const automated =
    !outbound &&
    Boolean(
      header('list-unsubscribe') ||
        header('list-id') ||
        /bulk|list|junk/i.test(header('precedence') ?? '') ||
        (header('auto-submitted') && header('auto-submitted') !== 'no') ||
        (from && AUTOMATED_SENDER.test(from.email)),
    );

  return {
    type: 'email',
    messageId: message.id,
    threadId: message.threadId,
    contact: people[0]?.key ?? (from ? (contactKey(from) ?? 'unknown') : 'unknown'),
    people,
    direction: outbound ? 'outbound' : 'inbound',
    // Gmail's thread id is the id of the thread's first message.
    firstInThread: message.id === message.threadId,
    subject: (header('subject') ?? '').trim().slice(0, 200),
    snippet: (message.snippet ?? '').slice(0, 240),
    body: messageText(message.payload),
    automated,
    sentAt,
    labels: labels.filter((l) => l === 'IMPORTANT' || l === 'STARRED' || l.startsWith('CATEGORY_')),
  };
}

/** The account's address (to tell sent from received). */
export async function fetchMailProfile(accessToken: string, fetchImpl?: FetchLike): Promise<{ emailAddress: string }> {
  return getJson('https://gmail.googleapis.com/gmail/v1/users/me/profile?fields=emailAddress', accessToken, fetchImpl);
}

/** Message ids matching the query, newest first, up to `max`. */
export async function listMessageIds(accessToken: string, query: string, max: number, fetchImpl?: FetchLike): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  while (ids.length < max) {
    const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    url.searchParams.set('q', query);
    url.searchParams.set('maxResults', String(Math.min(LIST_PAGE, max - ids.length)));
    url.searchParams.set('fields', 'nextPageToken,messages(id)');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const body = await getJson<{ messages?: { id: string }[]; nextPageToken?: string }>(url.toString(), accessToken, fetchImpl);
    ids.push(...(body.messages ?? []).map((m) => m.id));
    pageToken = body.nextPageToken;
    if (!pageToken) break;
  }
  return ids;
}

/**
 * Backing off after the quota trips. Measured recovery is seconds, not minutes, and the pace drops each time, so the
 * pauses stay short and there can be plenty of them; whatever they don't reach the next sync picks up.
 */
const RATE_LIMIT_PAUSE_MS = 15_000;
const MAX_RATE_LIMIT_PAUSES = 12;

const isRateLimited = (e: unknown) => e instanceof SourceSyncError && /rate limited/.test(e.message);

/**
 * New mail since `afterMs` (or the last MAIL_PAST_DAYS on the first sync), mapped to payloads, oldest first.
 * Messages are fetched oldest first, so when Gmail's per-minute quota keeps tripping the sync pauses a minute and
 * carries on, and after MAX_RATE_LIMIT_PAUSES it returns what it has (`complete: false`): the cursor then sits on
 * the newest message read and the next sync continues from there.
 * Gmail's `after:` has second precision, so a small overlap is fetched and dropped by id.
 */
export async function fetchMail(
  accessToken: string,
  now: Date,
  afterMs: number | null,
  known: (id: string) => boolean,
  fetchImpl?: FetchLike,
  onProgress?: (done: number, total: number, note?: string) => void,
  pauseMs = RATE_LIMIT_PAUSE_MS,
): Promise<{ messages: EmailPayload[]; listed: number; complete: boolean }> {
  const { emailAddress } = await fetchMailProfile(accessToken, fetchImpl);
  const since = afterMs ? `after:${Math.floor(afterMs / 1000) - 60}` : `newer_than:${MAIL_PAST_DAYS}d`;
  const max = afterMs ? MAIL_INCREMENTAL_MAX : MAIL_FIRST_SYNC_MAX;
  // Incremental syncs take everything new. A first sync ranks: priority mail first, then recent mail to fill.
  const listed = afterMs
    ? await listMessageIds(accessToken, `${since} ${MAIL_QUERY_BASE}`, max, fetchImpl)
    : [
        ...(await listMessageIds(accessToken, `${since} ${MAIL_QUERY_PRIORITY} ${MAIL_QUERY_BASE}`, Math.round(max * PRIORITY_SHARE), fetchImpl)),
        ...(await listMessageIds(accessToken, `${since} ${MAIL_QUERY_BASE}`, max, fetchImpl)),
      ];
  const ids = [...new Set(listed)]
    .filter((id) => !known(id))
    .slice(0, max)
    .reverse();

  const messages: EmailPayload[] = [];
  const done = () => {
    messages.sort((a, b) => (a.sentAt ?? '').localeCompare(b.sentAt ?? ''));
    return messages;
  };
  let pauses = 0;
  let perSecond = START_PER_SECOND;
  let cleanSince = 0;
  for (let i = 0; i < ids.length; ) {
    if (i % 100 === 0) onProgress?.(i, ids.length);
    const started = Date.now();
    let batch: (GmailMessage | null)[];
    try {
      batch = await Promise.all(
        ids.slice(i, i + GET_CONCURRENCY).map(async (id) => {
          const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`);
          url.searchParams.set('format', 'full');
          url.searchParams.set('fields', MESSAGE_FIELDS);
          try {
            return await getJson<GmailMessage>(url.toString(), accessToken, fetchImpl);
          } catch (e) {
            // A message deleted between list and get is not worth failing the sync for.
            if (e instanceof SourceSyncError && e.status === 404) return null;
            throw e;
          }
        }),
      );
    } catch (e) {
      if (!isRateLimited(e)) throw e;
      if (pauses >= MAX_RATE_LIMIT_PAUSES) {
        onProgress?.(i, ids.length, 'rate limited — keeping what was read, the next sync continues');
        return { messages: done(), listed: ids.length, complete: false };
      }
      pauses += 1;
      cleanSince = 0;
      perSecond = Math.max(MIN_PER_SECOND, perSecond / 2);
      onProgress?.(i, ids.length, `rate limited — waiting ${Math.round(pauseMs / 1000)}s, then ${perSecond.toFixed(1)}/s (${pauses}/${MAX_RATE_LIMIT_PAUSES})`);
      await new Promise((r) => setTimeout(r, pauseMs));
      continue;
    }
    const gap = (GET_CONCURRENCY / perSecond) * 1000;
    const elapsed = Date.now() - started;
    if (elapsed < gap && i + GET_CONCURRENCY < ids.length) await new Promise((r) => setTimeout(r, gap - elapsed));
    for (const m of batch) {
      if (!m) continue;
      if (m.payload?.headers) m.payload.headers = m.payload.headers.filter((h) => HEADERS.has(h.name.toLowerCase()));
      const payload = toEmailPayload(m, emailAddress);
      if (payload) messages.push(payload);
    }
    i += GET_CONCURRENCY;
    cleanSince += GET_CONCURRENCY;
    if (cleanSince >= SPEED_UP_AFTER && perSecond < MAX_PER_SECOND) {
      cleanSince = 0;
      perSecond = Math.min(MAX_PER_SECOND, perSecond * 1.5);
      onProgress?.(i, ids.length, `steady — trying ${perSecond.toFixed(1)}/s`);
    }
  }
  onProgress?.(ids.length, ids.length);
  return { messages: done(), listed: ids.length, complete: true };
}
