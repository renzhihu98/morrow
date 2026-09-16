/**
 * Canonical demo story (SPEC §6.2). All copy matches the Paper v2 designs.
 * User Iris, America/Los_Angeles, "now" = 2026-09-30 09:12 local.
 * All fixture dates fall inside PDT (UTC−07:00).
 */
import type {
  DossierResponse,
  ProphecyListResponse,
  ReadingDetailResponse,
  ReadingsResponse,
  SourcesResponse,
  TodayResponse,
} from '../api/types';
import { QUESTION_LIMIT } from '../constants';
import { prophecyRecord } from '../domain/prophecy';
import { questionsLeft } from '../domain/reading';
import type { Dossier } from '../schemas/dossier';
import type { Message, MessagePart } from '../schemas/message';
import type { Prophecy } from '../schemas/prophecy';
import type { Reading, ReadingSummary } from '../schemas/reading';
import type { Source } from '../schemas/source';
import type { User } from '../schemas/user';

const TZ = 'America/Los_Angeles';
/** Local wall time in PDT → ISO string with offset. */
const at = (date: string, time = '04:00') => `${date}T${time}:00-07:00`;
const rid = (date: string) => `r_${date}`;

export const FIXTURE_TIMEZONE = TZ;
export const FIXTURE_NOW_ISO = at('2026-09-30', '09:12');
export const FIXTURE_NOW = new Date(FIXTURE_NOW_ISO);
/** Archive label: "23 readings". */
export const FIXTURE_READINGS_TOTAL = 23;

const user: User = { id: 'u_iris', name: 'Iris', timezone: TZ };

// ─── Readings (newest first) ────────────────────────────────────────────────

const sealed = (
  date: string,
  nextDate: string,
  headline: string,
  prophecyId: string | null,
  summary: string,
  questionCount: number,
  openedTime: string,
): Reading => ({
  id: rid(date),
  localDate: date,
  timezone: TZ,
  status: 'sealed',
  headline,
  prophecyId,
  summary,
  questionCount,
  openedAt: at(date, openedTime),
  sealedAt: at(nextDate, '04:00'),
});

const readings: Reading[] = [
  {
    id: rid('2026-09-30'),
    localDate: '2026-09-30',
    timezone: TZ,
    status: 'open',
    headline: 'Sam wrote first.',
    prophecyId: 'p_0052',
    summary: null,
    questionCount: 0,
    openedAt: at('2026-09-30', '09:02'),
    sealedAt: null,
  },
  sealed(
    '2026-09-28',
    '2026-09-29',
    'The playlist changed before you did.',
    'p_0051',
    'Listening shifted brighter a day before Iris mentioned wanting a bigger role. Prophecy 0051 made about being asked to lead.',
    3,
    '07:05',
  ),
  sealed(
    '2026-09-27',
    '2026-09-28',
    'A quiet Saturday is not an empty one.',
    null,
    'Iris kept Saturday unscheduled and felt guilty about it; Morrow reframed rest. 0049 announced fulfilled — the old studio wrote.',
    1,
    '08:40',
  ),
  sealed(
    '2026-09-24',
    '2026-09-25',
    'Someone from the old studio is circling back.',
    'p_0049',
    'Mail from former studio colleagues picked up after 09.20. Prophecy 0049 made.',
    2,
    '06:58',
  ),
  sealed(
    '2026-09-22',
    '2026-09-23',
    'Three meetings about the same decision.',
    'p_0048',
    'Calendar showed three meetings circling one undecided question. Prophecy 0048 made: it resolves before Friday.',
    4,
    '06:20',
  ),
  sealed(
    '2026-09-19',
    '2026-09-20',
    'Your mornings are getting earlier.',
    null,
    'First activity has crept earlier each week, now around 06:10. Iris asked whether that is good; Morrow stayed neutral.',
    1,
    '06:15',
  ),
  sealed(
    '2026-09-16',
    '2026-09-17',
    "You've moved coffee with Sam four times since March. Each time, you reached out again.",
    'p_0047',
    'Coffee with Sam moved four times, always Mondays after late nights. Iris asked whether to say yes; Morrow said yes, on a Thursday morning. Prophecy 0047 made.',
    2,
    '06:43',
  ),
];

const readingSummaries: ReadingSummary[] = readings
  .filter((r): r is Reading & { summary: string } => r.summary !== null)
  .map((r) => ({ readingId: r.id, localDate: r.localDate, summary: r.summary }));

// ─── Prophecies (0041–0052) ────────────────────────────────────────────────

const prophecies: Prophecy[] = [
  {
    id: 'p_0041',
    number: 41,
    statement: "A song you'd forgotten will find you again.",
    title: "A song you'd forgotten will find you again.",
    checkCondition: { type: 'listening_pattern', pattern: 'A track not played in over a year is played again, unprompted.' },
    windowStart: at('2026-08-24'),
    windowEnd: at('2026-09-07'),
    likelihood: 0.6,
    watching: ['spotify'],
    status: 'fulfilled',
    madeOn: '2026-08-24',
    madeInReadingId: rid('2026-08-24'),
    fulfilledInReadingId: rid('2026-08-28'),
    resolvedAt: at('2026-08-28', '04:00'),
  },
  {
    id: 'p_0042',
    number: 42,
    statement: 'Your Thursday will stay yours.',
    title: 'Your Thursday will stay yours.',
    checkCondition: { type: 'generic', description: 'No meeting is added to Thursday morning this week.' },
    windowStart: at('2026-08-26'),
    windowEnd: at('2026-08-28'),
    likelihood: 0.66,
    watching: ['calendar'],
    status: 'fulfilled',
    madeOn: '2026-08-26',
    madeInReadingId: rid('2026-08-26'),
    fulfilledInReadingId: rid('2026-08-28'),
    resolvedAt: at('2026-08-28', '04:00'),
  },
  {
    id: 'p_0043',
    number: 43,
    statement: 'Mom will write before the weekend.',
    title: 'Mom will write before the weekend.',
    checkCondition: { type: 'email_from_contact', contact: 'mom', firstInThread: true },
    windowStart: at('2026-08-31'),
    windowEnd: at('2026-09-05'),
    likelihood: 0.7,
    watching: ['mail'],
    status: 'fulfilled',
    madeOn: '2026-08-31',
    madeInReadingId: rid('2026-08-31'),
    fulfilledInReadingId: rid('2026-09-04'),
    resolvedAt: at('2026-09-04', '09:00'),
  },
  {
    id: 'p_0044',
    number: 44,
    statement: 'A plan will fall through, and it will be a relief.',
    title: 'A plan will fall through.',
    checkCondition: { type: 'generic', description: 'A scheduled social event is cancelled by the other party.' },
    windowStart: at('2026-09-03'),
    windowEnd: at('2026-09-10'),
    likelihood: 0.52,
    watching: ['calendar'],
    status: 'expired',
    madeOn: '2026-09-03',
    madeInReadingId: rid('2026-09-03'),
    fulfilledInReadingId: null,
    resolvedAt: at('2026-09-10', '04:00'),
  },
  {
    id: 'p_0045',
    number: 45,
    statement: "You'll stay up for an album, not a screen.",
    title: "You'll stay up for an album.",
    checkCondition: { type: 'listening_pattern', pattern: 'A full album is played start to finish after 23:00.' },
    windowStart: at('2026-09-07'),
    windowEnd: at('2026-09-14'),
    likelihood: 0.57,
    watching: ['spotify'],
    status: 'fulfilled',
    madeOn: '2026-09-07',
    madeInReadingId: rid('2026-09-07'),
    fulfilledInReadingId: rid('2026-09-09'),
    resolvedAt: at('2026-09-09', '04:00'),
  },
  {
    id: 'p_0046',
    number: 46,
    statement: "An invitation will arrive that you'll want to accept.",
    title: 'An invitation you will want.',
    checkCondition: { type: 'calendar_event_with', contact: 'any', titleIncludes: null },
    windowStart: at('2026-09-11'),
    windowEnd: at('2026-09-18'),
    likelihood: 0.61,
    watching: ['calendar'],
    status: 'fulfilled',
    madeOn: '2026-09-11',
    madeInReadingId: rid('2026-09-11'),
    fulfilledInReadingId: rid('2026-09-14'),
    resolvedAt: at('2026-09-14', '04:00'),
  },
  {
    id: 'p_0047',
    number: 47,
    statement: 'Before the leaves finish turning, Sam will write first — and it will be the start of something easier.',
    title: 'Sam will write first.',
    checkCondition: { type: 'email_from_contact', contact: 'sam', firstInThread: true },
    windowStart: at('2026-09-16'),
    windowEnd: at('2026-10-07'),
    likelihood: 0.71,
    watching: ['calendar', 'mail'],
    status: 'fulfilled',
    madeOn: '2026-09-16',
    madeInReadingId: rid('2026-09-16'),
    fulfilledInReadingId: rid('2026-09-30'),
    resolvedAt: at('2026-09-30', '09:00'),
  },
  {
    id: 'p_0048',
    number: 48,
    statement: 'The decision will make itself before Friday.',
    title: 'The decision will make itself before Friday.',
    checkCondition: {
      type: 'generic',
      description: 'The recurring meetings about the pending decision are cancelled or concluded before Friday.',
    },
    windowStart: at('2026-09-22'),
    windowEnd: at('2026-09-26'),
    likelihood: 0.55,
    watching: ['calendar'],
    status: 'expired',
    madeOn: '2026-09-22',
    madeInReadingId: rid('2026-09-22'),
    fulfilledInReadingId: null,
    resolvedAt: at('2026-09-26', '04:00'),
  },
  {
    id: 'p_0049',
    number: 49,
    statement: 'Someone from the old studio will circle back.',
    title: 'Someone from the old studio will circle back.',
    checkCondition: { type: 'email_from_contact', contact: 'old_studio', firstInThread: true },
    windowStart: at('2026-09-24'),
    windowEnd: at('2026-10-08'),
    likelihood: 0.62,
    watching: ['mail'],
    status: 'fulfilled',
    madeOn: '2026-09-24',
    madeInReadingId: rid('2026-09-24'),
    fulfilledInReadingId: rid('2026-09-27'),
    resolvedAt: at('2026-09-27', '04:00'),
  },
  {
    id: 'p_0050',
    number: 50,
    statement: 'You will choose rest over a plan, and not regret it.',
    title: 'You will choose rest over a plan.',
    checkCondition: {
      type: 'generic',
      description: 'A planned calendar event is declined or dropped in favour of unscheduled time.',
    },
    windowStart: at('2026-09-26'),
    windowEnd: at('2026-10-03'),
    likelihood: 0.58,
    watching: ['calendar'],
    status: 'open',
    madeOn: '2026-09-26',
    madeInReadingId: rid('2026-09-26'),
    fulfilledInReadingId: null,
    resolvedAt: null,
  },
  {
    id: 'p_0051',
    number: 51,
    statement: 'Someone will ask you to lead the thing you quietly hoped for.',
    title: 'Someone will ask you to lead.',
    checkCondition: {
      type: 'generic',
      description: 'An email or invitation asks Iris to lead or own a project.',
    },
    windowStart: at('2026-09-28'),
    windowEnd: at('2026-10-19'),
    likelihood: 0.64,
    watching: ['calendar', 'mail'],
    status: 'open',
    madeOn: '2026-09-28',
    madeInReadingId: rid('2026-09-28'),
    fulfilledInReadingId: null,
    resolvedAt: null,
  },
  {
    id: 'p_0052',
    number: 52,
    statement: 'The old studio will offer more than a coffee.',
    title: 'The old studio will offer more than a coffee.',
    checkCondition: {
      type: 'generic',
      description: 'Mail from the old studio contains an offer of work or collaboration, not only a catch-up.',
    },
    windowStart: at('2026-09-30'),
    windowEnd: at('2026-10-30'),
    likelihood: 0.42,
    watching: ['mail'],
    status: 'open',
    madeOn: '2026-09-30',
    madeInReadingId: rid('2026-09-30'),
    fulfilledInReadingId: null,
    resolvedAt: null,
  },
];

// ─── Messages ───────────────────────────────────────────────────────────────

const opening = (date: string, time: string, parts: MessagePart[]): Message => ({
  id: `m_${date}_open`,
  readingId: rid(date),
  role: 'assistant',
  parts,
  createdAt: at(date, time),
});

const messages: Record<string, Message[]> = {
  [rid('2026-09-30')]: [
    opening('2026-09-30', '09:02', [
      { type: 'observation', text: 'Sam wrote first.', evidenceRef: 'dossier.people.sam.wrote_first', sourceLabel: 'Mail · 09.30 · 08:47' },
      { type: 'prophecyRef', prophecyId: 'p_0047', event: 'fulfilled' },
      { type: 'text', text: 'It came true, Iris — a week before the leaves finished turning.' },
      { type: 'prophecyRef', prophecyId: 'p_0052', event: 'made' },
    ]),
  ],
  [rid('2026-09-28')]: [
    opening('2026-09-28', '07:05', [
      { type: 'observation', text: 'The playlist changed before you did.', evidenceRef: 'dossier.rhythms.late_nights', sourceLabel: 'Spotify · 09.25 · 09.26 · 09.27' },
      { type: 'prophecyRef', prophecyId: 'p_0051', event: 'made' },
    ]),
  ],
  [rid('2026-09-27')]: [
    opening('2026-09-27', '08:40', [
      { type: 'prophecyRef', prophecyId: 'p_0049', event: 'fulfilled' },
      { type: 'observation', text: 'A quiet Saturday is not an empty one.', evidenceRef: 'dossier.rhythms.protected_time', sourceLabel: 'Calendar · 09.26' },
    ]),
  ],
  [rid('2026-09-24')]: [
    opening('2026-09-24', '06:58', [
      { type: 'observation', text: 'Someone from the old studio is circling back.', evidenceRef: 'dossier.people.old_studio', sourceLabel: 'Mail · 09.20 · 09.22 · 09.23' },
      { type: 'prophecyRef', prophecyId: 'p_0049', event: 'made' },
    ]),
  ],
  [rid('2026-09-22')]: [
    opening('2026-09-22', '06:20', [
      { type: 'observation', text: 'Three meetings about the same decision.', evidenceRef: 'dossier.rhythms.meetings', sourceLabel: 'Calendar · 09.18 · 09.21 · 09.22' },
      { type: 'prophecyRef', prophecyId: 'p_0048', event: 'made' },
    ]),
  ],
  [rid('2026-09-19')]: [
    opening('2026-09-19', '06:15', [
      { type: 'observation', text: 'Your mornings are getting earlier.', evidenceRef: 'dossier.rhythms.first_light', sourceLabel: 'Calendar · Spotify · 09.05 → 09.18' },
    ]),
  ],
  [rid('2026-09-16')]: [
    {
      id: 'm_2026-09-16_1',
      readingId: rid('2026-09-16'),
      role: 'user',
      parts: [{ type: 'text', text: "Draw today's reading." }],
      createdAt: at('2026-09-16', '06:43'),
    },
    {
      id: 'm_2026-09-16_2',
      readingId: rid('2026-09-16'),
      role: 'assistant',
      parts: [
        {
          type: 'observation',
          text: "You've moved coffee with Sam four times since March. Each time, you reached out again.",
          evidenceRef: 'dossier.people.sam.reschedules',
          sourceLabel: 'Calendar · 03.04 · 04.22 · 06.10 · 08.29',
        },
        { type: 'prophecyRef', prophecyId: 'p_0047', event: 'made' },
      ],
      createdAt: at('2026-09-16', '06:43'),
    },
    {
      id: 'm_2026-09-16_3',
      readingId: rid('2026-09-16'),
      role: 'user',
      parts: [{ type: 'text', text: 'Should I say yes to Sam this time?' }],
      createdAt: at('2026-09-16', '06:51'),
    },
    {
      id: 'm_2026-09-16_4',
      readingId: rid('2026-09-16'),
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: "Yes. But choose the day yourself — Thursday morning is open, and you haven't cancelled a Thursday since June.",
        },
        { type: 'text', text: 'The four times it slipped were all Mondays, each after a late night. It was never about Sam.' },
      ],
      createdAt: at('2026-09-16', '06:52'),
    },
  ],
};

/** Example "Morrow is reading…" steps for the Asking state (screen 06). */
const askingSteps: Extract<MessagePart, { type: 'steps' }> = {
  type: 'steps',
  items: [
    { label: 'Calendar — coffee with Sam, four moves', source: 'calendar', status: 'done' },
    { label: 'Mail — who wrote first', source: 'mail', status: 'active' },
    { label: 'Patterns — Mondays after late nights', status: 'pending' },
  ],
};

// ─── Sources & dossier ─────────────────────────────────────────────────────

const openProphecies = prophecies.filter((p) => p.status === 'open');
const watching = (kind: Source['kind']) => openProphecies.filter((p) => p.watching.includes(kind)).length;

const sources: Source[] = [
  {
    kind: 'calendar',
    name: 'Calendar',
    provider: 'Google',
    status: 'linked',
    reads: 'Your rhythms, who you make time for, what keeps moving.',
    stat: { value: 214, label: 'events' },
    watchingCount: watching('calendar'),
    lastSyncedAt: at('2026-09-30', '04:00'),
  },
  {
    kind: 'spotify',
    name: 'Spotify',
    provider: 'Spotify',
    status: 'linked',
    reads: 'Moods, late nights, the songs you return to.',
    stat: { value: 1208, label: 'plays' },
    watchingCount: watching('spotify'),
    lastSyncedAt: at('2026-09-30', '04:00'),
  },
  {
    kind: 'mail',
    name: 'Mail',
    provider: 'Gmail',
    status: 'linked',
    reads: 'Who writes first, who you wait on. Senders and timing only.',
    stat: null,
    watchingCount: watching('mail'),
    lastSyncedAt: at('2026-09-30', '09:00'),
  },
  {
    kind: 'instagram',
    name: 'Instagram',
    provider: 'Instagram',
    status: 'not_linked',
    reads: 'Who you keep up with, the places you return to.',
    stat: null,
    watchingCount: 0,
    lastSyncedAt: null,
  },
];

const dossier: Dossier = {
  userId: user.id,
  sizeBytes: 3200,
  rebuiltAt: at('2026-09-30', '04:00'),
  facts: [
    { id: 'rhythms.first_light', category: 'rhythms', label: 'First light', value: 'Earlier each week — 06:10 on average', sources: ['calendar', 'spotify'] },
    { id: 'rhythms.late_nights', category: 'rhythms', label: 'Late nights', value: '4 this month, all on Sundays', sources: ['spotify'] },
    { id: 'rhythms.protected_time', category: 'rhythms', label: 'Protected time', value: 'Thursday mornings — 11 kept since June', sources: ['calendar'] },
    { id: 'people.sam', category: 'people', label: 'Sam', value: 'Coffee moved 4 times · wrote first 09.30', sources: ['calendar', 'mail'] },
    { id: 'people.old_studio', category: 'people', label: 'The old studio', value: '3 threads since 09.20, warming', sources: ['mail'] },
    { id: 'people.mom', category: 'people', label: 'Mom', value: 'Every 9 days or so, usually Sunday', sources: ['mail'] },
  ],
  patterns: [
    { id: 'pattern.mondays_after_late_nights', statement: 'Mondays after late nights tend to go sideways.', confidence: 0.71, sources: ['calendar', 'spotify'] },
    { id: 'pattern.yes_to_plans', statement: 'You say yes to plans more easily than to rest.', confidence: 0.64, sources: ['calendar'] },
  ],
};

// ─── Ready-made API responses (demo mode) ──────────────────────────────────

const byId = new Map(prophecies.map((p) => [p.id, p]));
const referencedProphecies = (msgs: Message[]): Prophecy[] => {
  const ids = new Set<string>();
  for (const m of msgs) for (const part of m.parts) if (part.type === 'prophecyRef') ids.add(part.prophecyId);
  return [...ids].map((id) => byId.get(id)).filter((p): p is Prophecy => p !== undefined);
};

const today = readings[0]!;
const newestFirst = (a: Prophecy, b: Prophecy) => b.number - a.number;

const readingDetails: Record<string, ReadingDetailResponse> = Object.fromEntries(
  readings.map((r) => {
    const msgs = messages[r.id] ?? [];
    return [r.localDate, { reading: r, messages: msgs, prophecies: referencedProphecies(msgs) }];
  }),
);

const api: {
  today: TodayResponse;
  readings: ReadingsResponse;
  readingDetails: Record<string, ReadingDetailResponse>;
  prophecies: ProphecyListResponse;
  sources: SourcesResponse;
  dossier: DossierResponse;
} = {
  today: {
    user,
    now: FIXTURE_NOW_ISO,
    reading: today,
    messages: messages[today.id] ?? [],
    prophecies: referencedProphecies(messages[today.id] ?? []),
    questionLimit: QUESTION_LIMIT,
    questionsLeft: questionsLeft(today),
  },
  readings: { readings, total: FIXTURE_READINGS_TOTAL },
  readingDetails,
  prophecies: {
    open: openProphecies.slice().sort(newestFirst),
    resolved: prophecies.filter((p) => p.status !== 'open').sort(newestFirst),
    record: prophecyRecord(prophecies),
  },
  sources: {
    sources,
    dossier: { sizeBytes: dossier.sizeBytes, rebuiltAt: dossier.rebuiltAt, factCount: dossier.facts.length },
  },
  dossier: { dossier },
};

export const fixtures = {
  now: FIXTURE_NOW_ISO,
  timezone: TZ,
  readingsTotal: FIXTURE_READINGS_TOTAL,
  user,
  /** Newest first. */
  readings,
  readingSummaries,
  /** Keyed by reading id (`r_YYYY-MM-DD`). */
  messages,
  /** Ordered by number, 0041 → 0052. */
  prophecies,
  sources,
  dossier,
  askingSteps,
  /** Ready-made API response bodies; `readingDetails` keyed by local date. */
  api,
};
export type Fixtures = typeof fixtures;
