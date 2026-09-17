/**
 * Synthetic people for the eval suite. Every persona is invented — no real user data ever enters the fixtures.
 * A persona carries what the pipeline reads: a dossier, the aggregates behind the chat tools, and linked sources.
 */
import type { Dossier, DossierFact, SourceKind, User } from '@morrow/core';
import type { CalendarAggregates, DossierAggregates } from '../lib/dossier/aggregates';
import { AGGREGATES_VERSION } from '../lib/dossier/aggregates';
import type { MailAggregates } from '../lib/dossier/mail';
import type { PursuitIndex } from '../lib/dossier/pursuits';

export const EVAL_NOW = new Date('2026-09-17T16:00:00Z');
const TZ = 'America/Los_Angeles';
const DAY_MS = 86_400_000;

/** `-3` → three days before EVAL_NOW, at `hour` local. */
const at = (days: number, hour = 10) => new Date(EVAL_NOW.getTime() + days * DAY_MS - (16 - hour) * 3_600_000).toISOString();

type EventSpec = { id: string; day: number; hour?: number; title: string; calendar?: string; details?: string; people?: string[] };
type ThreadSpec = { id: string; day: number; subject: string; note: string; kind: 'personal' | 'work' | 'pursuit' | 'transactional'; status: 'waiting_on_you' | 'waiting_on_them' | 'done' | 'open'; from?: string; name?: string; outbound?: boolean };

function calendarOf(events: EventSpec[], names: Record<string, string>): CalendarAggregates {
  const calendars: Record<string, string> = {};
  const cal: CalendarAggregates = { events: {}, moves: [], names, calendars };
  for (const e of events) {
    const calendarId = e.calendar ? `${e.calendar.toLowerCase().replace(/\W+/g, '')}@group.calendar.google.com` : 'primary';
    if (e.calendar) calendars[calendarId] = e.calendar;
    cal.events[e.id] = {
      s: at(e.day, e.hour),
      e: at(e.day, (e.hour ?? 10) + 1),
      st: 'c',
      p: e.people ?? [],
      t: e.title,
      k: calendarId,
      ...(e.details ? { x: e.details } : {}),
    };
  }
  return cal;
}

function mailOf(threads: ThreadSpec[], names: Record<string, string>): MailAggregates {
  const mail: MailAggregates = { cursorMs: EVAL_NOW.getTime(), messages: {}, threads: {}, names };
  for (const t of threads) {
    mail.messages[`${t.id}:1`] = { t: at(t.day), d: t.outbound ? 'o' : 'i', th: t.id, p: t.from ? [t.from] : [], f: true };
    mail.messages[`${t.id}:2`] = { t: at(t.day, 12), d: t.outbound ? 'i' : 'o', th: t.id, p: t.from ? [t.from] : [] };
    mail.threads[t.id] = { s: t.subject, at: at(t.day, 12), n: t.note, k: t.kind, st: t.status, na: at(t.day, 12) };
  }
  return mail;
}

export type Persona = {
  id: string;
  user: User;
  sources: SourceKind[];
  dossier: Dossier;
  aggregates: DossierAggregates;
  /** What a grader may expect the model to have seen (used for recital checks). */
  literals: string[];
};

function persona(args: {
  id: string;
  name: string;
  sources: SourceKind[];
  facts: DossierFact[];
  events?: EventSpec[];
  threads?: ThreadSpec[];
  pursuits?: PursuitIndex['pursuits'];
  names?: Record<string, string>;
}): Persona {
  const names = args.names ?? {};
  const calendar = args.events ? calendarOf(args.events, names) : null;
  const mail = args.threads ? mailOf(args.threads, names) : null;
  const pursuits: PursuitIndex | null = args.pursuits
    ? {
        pursuits: args.pursuits,
        titles: Object.fromEntries((args.events ?? []).map((e) => [e.title.toLowerCase(), args.pursuits![0]!.key])),
        threads: Object.fromEntries((args.threads ?? []).filter((t) => t.kind === 'pursuit').map((t) => [t.id, args.pursuits![0]!.key])),
        at: EVAL_NOW.toISOString(),
      }
    : null;
  return {
    id: args.id,
    user: { id: `u_${args.id}`, name: args.name, timezone: TZ },
    sources: args.sources,
    dossier: { userId: `u_${args.id}`, facts: args.facts, patterns: [], sizeBytes: 2048, rebuiltAt: EVAL_NOW.toISOString() },
    aggregates: { version: AGGREGATES_VERSION, forgotten: [], calendar, spotify: null, mail, pursuits },
    literals: [
      ...(args.events ?? []).flatMap((e) => [e.title, e.calendar ?? '']),
      ...(args.threads ?? []).map((t) => t.subject),
      ...Object.values(names),
    ].filter(Boolean),
  };
}

/** A job seeker deep in interviews: calendar and mail both busy, one pursuit. */
export const jobSeeker = persona({
  id: 'job_seeker',
  name: 'Wren',
  sources: ['calendar', 'mail'],
  names: { dana_reyes: 'Dana Reyes', kit_alvarez: 'Kit Alvarez' },
  facts: [
    {
      id: 'pursuits.job_search',
      category: 'pursuits',
      label: 'Job search',
      value: 'Applications, recruiter calls and interviews · going since 08.04 · 9 on the calendar so far · 6 email threads · picking up over the last two weeks · waiting to hear back on 2 · 3 still ahead, next on 09.19',
      sources: ['calendar', 'mail'],
    },
    { id: 'rhythms.mail_unanswered', category: 'rhythms', label: 'Unanswered', value: '2 threads wait on your reply, oldest from 09.09', sources: ['mail'] },
    { id: 'people.dana_reyes', category: 'people', label: 'Dana', value: '4 threads by mail · they wrote first 3 times · last 09.15', sources: ['mail'] },
    { id: 'rhythms.protected_time', category: 'rhythms', label: 'Protected time', value: 'Thursday evenings — never moved or cancelled, kept 9 times since 07.02', sources: ['calendar'] },
  ],
  events: [
    { id: 'e1', day: -12, title: 'Recruiter call', calendar: 'Job search', people: ['dana_reyes'] },
    { id: 'e2', day: -6, title: 'System design prep', calendar: 'Job search', details: 'Work through the caching chapter' },
    { id: 'e3', day: -2, title: 'Portfolio review', calendar: 'Job search', people: ['kit_alvarez'] },
    { id: 'e4', day: 2, hour: 14, title: 'Final interview', calendar: 'Job search', details: 'Panel with the design team' },
    { id: 'e5', day: -3, hour: 19, title: 'Climbing', people: [] },
  ],
  threads: [
    { id: 't1', day: -8, subject: 'Next steps', note: 'A recruiter asked for your availability for a second conversation.', kind: 'pursuit', status: 'waiting_on_you', from: 'dana_reyes', name: 'Dana Reyes' },
    { id: 't2', day: -2, subject: 'Panel details', note: 'They sent the panel format and asked you to confirm.', kind: 'pursuit', status: 'waiting_on_you', from: 'dana_reyes' },
    { id: 't3', day: -5, subject: 'Your application', note: 'You sent an application and have not heard back.', kind: 'pursuit', status: 'waiting_on_them', outbound: true },
    { id: 't4', day: -4, subject: 'Dinner Sunday?', note: 'A friend suggested dinner and is waiting on a day from you.', kind: 'personal', status: 'waiting_on_you', from: 'kit_alvarez' },
  ],
  pursuits: [{ key: 'job_search', label: 'Job search', summary: 'applications, recruiter calls and interviews' }],
});

/** Someone steady: no pursuit, people and rhythms only. */
export const steady = persona({
  id: 'steady',
  name: 'Noor',
  sources: ['calendar', 'spotify'],
  names: { ada_kim: 'Ada Kim' },
  facts: [
    { id: 'people.ada_kim', category: 'people', label: 'Ada', value: 'Moved 4 times, mostly Mondays (08.10 · 08.24 · 09.07) · Met 7 times since 07.01, every 9 days or so · last 09.12', sources: ['calendar'] },
    { id: 'rhythms.busiest_day', category: 'rhythms', label: 'Fullest day', value: 'Wednesdays carry the most, and have since midsummer', sources: ['calendar'] },
    { id: 'tastes.new_in_rotation', category: 'tastes', label: 'New in rotation', value: 'Two artists in this month’s heavy rotation that were not there six months ago', sources: ['spotify'] },
  ],
  events: [
    { id: 'e1', day: -5, title: 'Coffee with Ada', people: ['ada_kim'] },
    { id: 'e2', day: -1, hour: 18, title: 'Choir', calendar: 'Music' },
    { id: 'e3', day: 3, hour: 9, title: 'Dentist' },
  ],
});

/** A brand-new account: one thin fact, nothing else. The pipeline must not invent a life. */
export const newcomer = persona({
  id: 'newcomer',
  name: 'Ash',
  sources: ['spotify'],
  facts: [{ id: 'tastes.top_artists', category: 'tastes', label: 'On repeat', value: 'Three artists carry most of this month’s listening', sources: ['spotify'] }],
});

export const PERSONAS: Persona[] = [jobSeeker, steady, newcomer];
export const personaById = (id: string): Persona => PERSONAS.find((p) => p.id === id) ?? jobSeeker;
