/**
 * Pursuits: what the person's calendar is *about*, not just when it happens (SPEC §12.4). Event titles — with
 * their calendar's name and the start of their details — are grouped into a few ongoing pursuits (a job search,
 * a course, a move, training for something) by Haiku. Counts, dates and momentum are computed deterministically.
 */
import { formatShortDate, getReadingDate, type DossierFact } from '@morrow/core';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { MODELS } from '../ai/models';
import { findTaboo } from '../ai/taboo';
import { hasModelAccess } from '../server/env';
import type { CalendarAggregates, CalendarEventState } from './aggregates';
import { meaningfulThreads, type MailAggregates } from './mail';

const DAY_MS = 86_400_000;
const MAX_TITLES = 400;
const MAX_PURSUITS = 5;
/** Past window for "lately" momentum. */
const RECENT_DAYS = 14;

export type Pursuit = {
  key: string;
  label: string;
  /** What the pursuit is, in the classifier's words (no names of companies, people or places). */
  summary: string;
};

/** Stored with the aggregates: classifier output, and every title it has seen (so it only reruns on new titles). */
export type PursuitIndex = {
  pursuits: Pursuit[];
  /** normalized title → pursuit key, or null when the title belongs to no pursuit */
  titles: Record<string, string | null>;
  /** mail thread id → pursuit key, or null */
  threads?: Record<string, string | null>;
  at: string;
};

export const normalizeTitle = (t: string) => t.trim().toLowerCase().replace(/\s+/g, ' ');

/** Events that are the person's own time and carry a title. */
const titled = (e: CalendarEventState) => Boolean(e.t) && e.st !== 'x' && !e.d && !e.sh;

const Classification = z.object({
  pursuits: z
    .array(
      z.object({
        key: z.string().describe('snake_case slug, e.g. "job_search"'),
        label: z.string().describe('Two to four words, sentence case, e.g. "Job search"'),
        summary: z.string().describe('One plain phrase, max 14 words, what this pursuit looks like on the calendar.'),
        titleIndexes: z.array(z.number().int()).describe('Indexes of the items (events and emails) that belong to it.'),
      }),
    )
    .max(MAX_PURSUITS),
});

const INSTRUCTIONS = `You read events on one person's calendar (title, the calendar it is on, the start of its details) and notes on their email threads, and name the ongoing pursuits in their life right now.
A calendar's name is a strong signal: a calendar called "Job search" or "Thesis" is a pursuit in itself.
A pursuit is something they are working toward over weeks: a job search, a course or exam, moving home, training for a race, a creative project, planning a trip, learning something.
- Return at most ${MAX_PURSUITS} pursuits, the most significant first. Only real, recurring threads — at least three items (events or emails) each. Emails and events about the same pursuit belong together.
- Routine work meetings, standups, generic 1:1s, meals and errands are not pursuits.
- Labels and summaries must not contain names of companies, people, places or schools. Say "interviews and recruiter calls", not who with.
- Never label anything about health, therapy, pregnancy, death, debt or a relationship ending. Leave those titles out.
- Titles may be in any language; write labels and summaries in English.`;

/** Asks Haiku to group titles into pursuits. Returns null without model access or on failure. */
async function classify(titles: string[], lines: string[]): Promise<{ pursuits: Pursuit[]; assignment: Map<string, string> } | null> {
  if (!hasModelAccess() || titles.length === 0) return null;
  try {
    const { output } = await generateText({
      model: MODELS.summary,
      instructions: INSTRUCTIONS,
      output: Output.object({ schema: Classification }),
      prompt: lines.map((line, i) => `${i}. ${line}`).join('\n'),
    });
    const assignment = new Map<string, string>();
    const pursuits: Pursuit[] = [];
    for (const p of output.pursuits) {
      const key = p.key.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
      const members = [...new Set(p.titleIndexes)].filter((i) => i >= 0 && i < titles.length);
      if (!key || members.length < 3 || findTaboo(`${p.label} ${p.summary}`) || pursuits.some((x) => x.key === key)) continue;
      pursuits.push({ key, label: p.label.trim(), summary: p.summary.trim() });
      for (const i of members) if (!assignment.has(titles[i]!)) assignment.set(titles[i]!, key);
    }
    return { pursuits, assignment };
  } catch (e) {
    console.error('[morrow] pursuit classification failed', e);
    return null;
  }
}

const MAX_THREADS = 250;
/** New items needed before the classifier reruns (unless the index is a day old). */
const RECLASSIFY_AFTER = 5;

/**
 * Brings the pursuit index up to date from calendar titles and noted mail threads. The classifier reruns when
 * enough unseen items appear (or a day has passed with any), over everything current, so pursuits can merge,
 * split or fade. Taboo items are never sent.
 */
export async function refreshPursuits(
  cal: CalendarAggregates | null,
  previous: PursuitIndex | null | undefined,
  now: Date,
  mail?: MailAggregates | null,
): Promise<PursuitIndex | null> {
  if (!cal && !mail) return null;
  const counts = new Map<string, number>();
  const context = new Map<string, string>();
  for (const e of Object.values(cal?.events ?? {})) {
    if (!titled(e)) continue;
    const t = normalizeTitle(e.t!);
    const calendar = e.k ? cal!.calendars?.[e.k] : undefined;
    const details = e.x?.replace(/\s+/g, ' ').slice(0, 100);
    if (!t || findTaboo(`${t} ${details ?? ''}`)) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
    if (!context.has(t) || (details && !context.get(t)!.includes('—'))) {
      context.set(t, [e.t!.trim(), calendar ? `calendar "${calendar}"` : null, details ? `— ${details}` : null].filter(Boolean).join(' · '));
    }
  }
  const titles = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_TITLES)
    .map(([t]) => t);
  const threads = (mail ? meaningfulThreads(mail) : [])
    .filter(([, th]) => !findTaboo(`${th.s} ${th.n}`))
    .sort((a, b) => b[1].at.localeCompare(a[1].at))
    .slice(0, MAX_THREADS);

  if (previous) {
    const unseen = titles.filter((t) => !(t in previous.titles)).length + threads.filter(([id]) => !(id in (previous.threads ?? {}))).length;
    const stale = now.getTime() - Date.parse(previous.at) > DAY_MS;
    if (unseen === 0 || (unseen < RECLASSIFY_AFTER && !stale)) return previous;
  }

  const lines = [
    ...titles.map((t) => `event: ${context.get(t) ?? t}`),
    ...threads.map(([, th]) => `email: "${th.s}" — ${th.n}`),
  ];
  const result = await classify([...titles, ...threads.map(([id]) => `mail:${id}`)], lines);
  if (!result) return previous ?? null;
  return {
    pursuits: result.pursuits,
    titles: Object.fromEntries(titles.map((t) => [t, result.assignment.get(t) ?? null])),
    threads: Object.fromEntries(threads.map(([id]) => [id, result.assignment.get(`mail:${id}`) ?? null])),
    at: now.toISOString(),
  };
}

/** One `pursuits.<key>` fact per pursuit that is still active (something in the last 60 days or ahead). */
export function pursuitFacts(
  cal: CalendarAggregates | null,
  index: PursuitIndex | null | undefined,
  timeZone: string,
  now: Date,
  mail?: MailAggregates | null,
): DossierFact[] {
  if (!index || index.pursuits.length === 0) return [];
  const byKey = new Map<string, CalendarEventState[]>();
  for (const e of Object.values(cal?.events ?? {})) {
    if (!titled(e)) continue;
    const key = index.titles[normalizeTitle(e.t!)];
    if (!key) continue;
    byKey.set(key, [...(byKey.get(key) ?? []), e]);
  }
  const threadsByKey = new Map<string, { at: string; st?: string; n?: string }[]>();
  for (const [id, key] of Object.entries(index.threads ?? {})) {
    const th = mail?.threads[id];
    if (!key || !th) continue;
    threadsByKey.set(key, [...(threadsByKey.get(key) ?? []), th]);
  }

  const t = now.getTime();
  const fmt = (iso: string) => formatShortDate(getReadingDate(new Date(iso), timeZone, 0));
  const facts: DossierFact[] = [];
  for (const pursuit of index.pursuits) {
    const events = (byKey.get(pursuit.key) ?? []).sort((a, b) => Date.parse(a.s) - Date.parse(b.s));
    const threads = (threadsByKey.get(pursuit.key) ?? []).sort((a, b) => a.at.localeCompare(b.at));
    if (events.length === 0 && threads.length === 0) continue;
    const past = events.filter((e) => Date.parse(e.s) <= t);
    const ahead = events.filter((e) => Date.parse(e.s) > t);
    const activity = [...past.map((e) => e.s), ...threads.map((th) => th.at)].sort();
    const recent = activity.filter((a) => Date.parse(a) > t - RECENT_DAYS * DAY_MS).length;
    const before = activity.filter((a) => Date.parse(a) <= t - RECENT_DAYS * DAY_MS && Date.parse(a) > t - 2 * RECENT_DAYS * DAY_MS).length;
    const last = activity.at(-1);
    if (ahead.length === 0 && (!last || Date.parse(last) < t - 60 * DAY_MS)) continue;

    const momentum =
      recent === 0 && before === 0
        ? null
        : recent > before * 1.5
          ? 'picking up over the last two weeks'
          : recent * 1.5 < before
            ? 'quieter over the last two weeks than the two before'
            : 'steady over the last month';
    const waiting = threads.filter((th) => th.st === 'waiting_on_them').length;
    const unanswered = threads.filter((th) => th.st === 'waiting_on_you').length;
    const latest = [...threads].reverse().find((th) => th.n)?.n;
    const carried = [past.length > 0 ? `${past.length} on the calendar` : null, threads.length > 0 ? `${threads.length} by mail` : null].filter(Boolean).join(', ');
    const parts = [
      `${pursuit.summary.charAt(0).toUpperCase()}${pursuit.summary.slice(1).replace(/[.\s]+$/, '')}`,
      activity[0] ? `You have been carrying this since ${fmt(activity[0])} (${carried})` : null,
      momentum ? `It is ${momentum}` : null,
      waiting > 0 ? `${waiting === 1 ? 'One answer has' : `${waiting} answers have`} not come back yet` : null,
      unanswered > 0 ? `${unanswered === 1 ? 'one conversation waits' : `${unanswered} conversations wait`} on you` : null,
      ahead.length > 0 ? `The next step is already set for ${fmt(ahead[0]!.s)}${ahead.length > 1 ? `, with ${ahead.length - 1} more behind it` : ''}` : events.length > 0 ? 'Nothing is set ahead yet' : null,
      latest ? `Where it stands: ${latest}` : null,
    ].filter(Boolean);
    const sources = [...(events.length > 0 ? (['calendar'] as const) : []), ...(threads.length > 0 ? (['mail'] as const) : [])];
    facts.push({ id: `pursuits.${pursuit.key}`, category: 'pursuits', label: pursuit.label, value: `${parts.join('. ')}.`, sources });
  }
  return facts;
}
