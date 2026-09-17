/**
 * Mail aggregates and thread notes (SPEC §12.4). Message bodies live in raw_events for 24h; at sync time Haiku
 * reads each changed thread's latest messages and writes a one-line note (what it's about, where it stands).
 * Only notes, subjects and timing survive in the aggregates — never bodies.
 */
import { formatShortDate, getReadingDate, type DossierFact } from '@morrow/core';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { MODELS } from '../ai/models';
import { findTaboo } from '../ai/taboo';
import { hasModelAccess } from '../server/env';
import type { EmailPayload } from '../sources/types';

const DAY_MS = 86_400_000;
export const MAIL_RETENTION_DAYS = 180;
const MAX_MESSAGES = 6000;
/** Threads noted per sync (newest activity first); the rest keep their previous note. */
export const MAX_THREADS_NOTED = 400;
const NOTE_BATCH = 20;
const NOTE_CONCURRENCY = 4;
const BODY_IN_PROMPT = 900;

export type ThreadKind = 'personal' | 'work' | 'pursuit' | 'transactional' | 'newsletter' | 'other';
export type ThreadStatus = 'waiting_on_you' | 'waiting_on_them' | 'done' | 'open';

/** Compact per-message state (persisted per user). */
export type MailMessageState = {
  /** sent at (ISO) */
  t: string;
  /** direction: i inbound · o outbound */
  d: 'i' | 'o';
  th: string;
  /** contact keys of the other people */
  p: string[];
  /** automated (list, notification, no-reply) */
  a?: true;
  /** first in thread */
  f?: true;
};

export type MailThreadState = {
  /** subject */
  s: string;
  /** last activity (ISO) */
  at: string;
  /** Haiku note: what the thread is about and where it stands (no bodies) */
  n?: string;
  k?: ThreadKind;
  st?: ThreadStatus;
  /** noted up to this activity (ISO) — a newer message re-notes the thread */
  na?: string;
};

export type MailAggregates = {
  /** internalDate (ms) of the newest message folded in — the `after:` cursor. */
  cursorMs: number;
  messages: Record<string, MailMessageState>;
  threads: Record<string, MailThreadState>;
  /** contact key → display name (first seen) */
  names: Record<string, string>;
};

export type ThreadNote = { note: string; kind: ThreadKind; status: ThreadStatus };

/** Folds new messages (and notes for their threads) into the aggregates. */
export function foldMail(prev: MailAggregates | null | undefined, messages: EmailPayload[], notes: Map<string, ThreadNote>, now: Date): MailAggregates {
  const agg: MailAggregates = prev
    ? { cursorMs: prev.cursorMs, messages: { ...prev.messages }, threads: { ...prev.threads }, names: { ...prev.names } }
    : { cursorMs: 0, messages: {}, threads: {}, names: {} };

  for (const m of messages) {
    if (!m.messageId || !m.sentAt) continue;
    const at = Date.parse(m.sentAt);
    if (at > agg.cursorMs) agg.cursorMs = at;
    const state: MailMessageState = { t: m.sentAt, d: m.direction === 'outbound' ? 'o' : 'i', th: m.threadId, p: (m.people ?? []).map((p) => p.key) };
    if (m.automated) state.a = true;
    if (m.firstInThread) state.f = true;
    agg.messages[m.messageId] = state;
    for (const person of m.automated ? [] : (m.people ?? [])) {
      if (person.displayName && !agg.names[person.key]) agg.names[person.key] = person.displayName;
    }
    const thread = agg.threads[m.threadId];
    if (!thread || Date.parse(thread.at) <= at) {
      agg.threads[m.threadId] = { ...thread, s: m.subject || thread?.s || '', at: m.sentAt };
    }
  }
  for (const [threadId, note] of notes) {
    const thread = agg.threads[threadId];
    if (!thread) continue;
    agg.threads[threadId] = { ...thread, n: note.note, k: note.kind, st: note.status, na: thread.at };
  }

  const cutoff = now.getTime() - MAIL_RETENTION_DAYS * DAY_MS;
  let entries = Object.entries(agg.messages).filter(([, m]) => Date.parse(m.t) >= cutoff);
  if (entries.length > MAX_MESSAGES) entries = entries.sort((a, b) => b[1].t.localeCompare(a[1].t)).slice(0, MAX_MESSAGES);
  agg.messages = Object.fromEntries(entries);
  const live = new Set(entries.map(([, m]) => m.th));
  agg.threads = Object.fromEntries(Object.entries(agg.threads).filter(([id]) => live.has(id)));
  return agg;
}

const NoteOutput = z.object({
  threads: z.array(
    z.object({
      i: z.number().int(),
      kind: z.enum(['personal', 'work', 'pursuit', 'transactional', 'newsletter', 'other']),
      status: z.enum(['waiting_on_you', 'waiting_on_them', 'done', 'open']),
      note: z.string().describe('Max 20 words. What the thread is about and where it stands. Empty for newsletters.'),
    }),
  ),
});

const NOTE_INSTRUCTIONS = `You read email threads from one person's inbox (the person is "you") and write a short note for each.
- kind: personal (friends, family), work (their current job), pursuit (something they are working toward: job applications, recruiters, interviews, a course, a move, a trip), transactional (receipts, deliveries, accounts), newsletter (bulk updates), other.
- status: waiting_on_you (someone asked them something and they haven't answered), waiting_on_them (they wrote last and are waiting), done, open.
- note: max 20 words, plain, second person, what it's about and where it stands — e.g. "A recruiter at a design studio asked for your availability for a second interview." Keep company and people names only when they matter to the thread.
- Never note anything about health, therapy, pregnancy, death, debt or money trouble, or a relationship ending: use kind "other" and an empty note.
- Never copy links, codes, passwords, account numbers or addresses.`;

type ThreadInput = { threadId: string; text: string };

/** The latest messages of each changed thread, as prompt text. Taboo threads are never sent. */
export function threadInputs(messages: EmailPayload[], agg: MailAggregates | null | undefined, max = MAX_THREADS_NOTED): ThreadInput[] {
  const byThread = new Map<string, EmailPayload[]>();
  for (const m of messages) byThread.set(m.threadId, [...(byThread.get(m.threadId) ?? []), m]);
  return [...byThread.entries()]
    .map(([threadId, msgs]) => {
      const sorted = msgs.sort((a, b) => (a.sentAt ?? '').localeCompare(b.sentAt ?? ''));
      const last = sorted.at(-1)!;
      return { threadId, last, sorted };
    })
    .filter(({ threadId, last }) => {
      const noted = agg?.threads[threadId]?.na;
      return !noted || (last.sentAt ?? '') > noted;
    })
    .sort((a, b) => (b.last.sentAt ?? '').localeCompare(a.last.sentAt ?? ''))
    .slice(0, max)
    .flatMap(({ threadId, sorted }) => {
      const previous = agg?.threads[threadId]?.n;
      const latest = sorted.slice(-2).map((m) => {
        const who = m.direction === 'outbound' ? 'You' : (m.people?.[0]?.displayName ?? m.people?.[0]?.key ?? 'Someone');
        return `${who}${m.automated ? ' (automated)' : ''}, ${m.sentAt?.slice(0, 10)}: ${(m.body || m.snippet || '').slice(0, BODY_IN_PROMPT)}`;
      });
      const text = [`Subject: ${sorted.at(-1)!.subject || '(none)'}`, previous ? `Earlier note: ${previous}` : null, ...latest].filter(Boolean).join('\n');
      return findTaboo(text) ? [] : [{ threadId, text }];
    });
}

/** Notes for changed threads via Haiku, in batches. Without model access (or on failure) returns what it has. */
export async function noteThreads(inputs: ThreadInput[]): Promise<Map<string, ThreadNote>> {
  const notes = new Map<string, ThreadNote>();
  if (!hasModelAccess() || inputs.length === 0) return notes;
  const batches: ThreadInput[][] = [];
  for (let i = 0; i < inputs.length; i += NOTE_BATCH) batches.push(inputs.slice(i, i + NOTE_BATCH));

  const run = async (batch: ThreadInput[]) => {
    try {
      const { output } = await generateText({
        model: MODELS.summary,
        instructions: NOTE_INSTRUCTIONS,
        output: Output.object({ schema: NoteOutput }),
        prompt: batch.map((t, i) => `### Thread ${i}\n${t.text}`).join('\n\n'),
      });
      for (const t of output.threads) {
        const input = batch[t.i];
        if (!input) continue;
        const note = t.kind === 'newsletter' || findTaboo(t.note) ? '' : t.note.trim().slice(0, 200);
        notes.set(input.threadId, { note, kind: t.kind, status: t.status });
      }
    } catch (e) {
      console.error('[morrow] thread notes failed', e);
    }
  };
  for (let i = 0; i < batches.length; i += NOTE_CONCURRENCY) await Promise.all(batches.slice(i, i + NOTE_CONCURRENCY).map(run));
  return notes;
}

// ─── facts ─────────────────────────────────────────────────────────────────

const date = (iso: string, tz: string) => formatShortDate(getReadingDate(new Date(iso), tz, 0));
const titleCase = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Thread states that describe the person's life (not newsletters, receipts or empty notes). */
export const meaningfulThreads = (mail: MailAggregates) =>
  Object.entries(mail.threads).filter(([, t]) => t.n && t.k !== 'newsletter' && t.k !== 'transactional');

/** People they actually correspond with (non-automated, both directions), strongest first. */
export function mailPeopleFacts(mail: MailAggregates | null | undefined, tz: string, now: Date, max = 6): DossierFact[] {
  if (!mail) return [];
  const since = now.getTime() - 90 * DAY_MS;
  const stats = new Map<string, { sent: number; received: number; firstWriter: number; threads: Set<string>; last: string }>();
  for (const m of Object.values(mail.messages)) {
    if (m.a || Date.parse(m.t) < since || m.p.length === 0 || m.p.length > 6) continue;
    for (const key of m.p) {
      const s = stats.get(key) ?? { sent: 0, received: 0, firstWriter: 0, threads: new Set<string>(), last: m.t };
      if (m.d === 'o') s.sent += 1;
      else s.received += 1;
      if (m.f && m.d === 'i') s.firstWriter += 1;
      s.threads.add(m.th);
      if (m.t > s.last) s.last = m.t;
      stats.set(key, s);
    }
  }
  return [...stats.entries()]
    .filter(([, s]) => s.sent > 0 && s.received > 0 && s.threads.size >= 2)
    .sort((a, b) => b[1].sent + b[1].received - (a[1].sent + a[1].received))
    .slice(0, max)
    .map(([key, s]) => {
      const name = mail.names[key] ?? titleCase(key);
      const latest = Object.entries(mail.threads)
        .filter(([id, t]) => s.threads.has(id) && t.n)
        .sort((a, b) => b[1].at.localeCompare(a[1].at))[0]?.[1];
      const parts = [
        s.firstWriter > s.threads.size / 2
          ? `They are usually the one to reach first (${s.firstWriter} of ${s.threads.size} threads)`
          : s.firstWriter > 0
            ? `You open most of it, though they reach first sometimes (${s.firstWriter} of ${s.threads.size} threads)`
            : `You are always the one to open the thread (${s.threads.size} of them)`,
        `last word ${date(s.last, tz)}`,
        latest?.n ? `where it stands: ${latest.n}` : null,
      ].filter(Boolean);
      return { id: `people.${key}`, category: 'people' as const, label: name.split(/\s+/)[0] ?? name, value: parts.join(' · '), sources: ['mail' as const] };
    });
}

/** Threads where the next word is theirs, and the mail they're waiting on. */
export function mailRhythmFacts(mail: MailAggregates | null | undefined, tz: string, now: Date): DossierFact[] {
  if (!mail) return [];
  const recent = meaningfulThreads(mail).filter(([, t]) => Date.parse(t.at) > now.getTime() - 21 * DAY_MS);
  const facts: DossierFact[] = [];
  const onYou = recent.filter(([, t]) => t.st === 'waiting_on_you').sort((a, b) => a[1].at.localeCompare(b[1].at));
  if (onYou.length > 0) {
    facts.push({
      id: 'rhythms.mail_unanswered',
      category: 'rhythms',
      label: 'Unanswered',
      value: `The next word is yours in ${onYou.length === 1 ? 'one conversation' : `${onYou.length} conversations`}, the oldest since ${date(onYou[0]![1].at, tz)} — ${onYou
        .slice(0, 3)
        .map(([, t]) => t.n)
        .join(' · ')}`,
      sources: ['mail'],
    });
  }
  const onThem = recent.filter(([, t]) => t.st === 'waiting_on_them').sort((a, b) => b[1].at.localeCompare(a[1].at));
  if (onThem.length > 0) {
    facts.push({
      id: 'rhythms.mail_waiting',
      category: 'rhythms',
      label: 'Waiting on',
      value: `You have said your piece and are waiting in ${onThem.length === 1 ? 'one conversation' : `${onThem.length} conversations`} — ${onThem
        .slice(0, 3)
        .map(([, t]) => t.n)
        .join(' · ')}`,
      sources: ['mail'],
    });
  }
  return facts;
}
