import {
  DailyReadingOutput,
  formatProphecyNumber,
  type Dossier,
  type DossierFact,
  type DossierPattern,
  type Message,
  type Prophecy,
  type Reading,
  type ReadingSummary,
  type SourceKind,
  type User,
} from '@morrow/core';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { hasModelAccess, isDemoData } from '../server/env';
import { MODELS } from './models';
import { connectedSources, dailyReadingPrompt, dossierContacts, dossierPursuits, SUMMARY_INSTRUCTIONS } from './prompts';
import { findTaboo, isReadingSafe } from './taboo';

export type ReadingContext = {
  user: User;
  now: Date;
  localDate: string;
  dossier: Dossier | null;
  summaries: ReadingSummary[];
  prophecies: Prophecy[];
  /** Connected sources (defaults to the sources behind the dossier's facts). */
  sources?: SourceKind[];
};

/** Dossier ids may be cited with or without the `dossier.` prefix, and with a sub-path (`people.sam.moves`). */
export function resolveEvidence(dossier: Dossier | null, evidenceRef: string): DossierFact | DossierPattern | null {
  if (!dossier) return null;
  const ref = evidenceRef.trim().replace(/^dossier\./, '');
  const items: (DossierFact | DossierPattern)[] = [...dossier.facts, ...dossier.patterns];
  return items.find((i) => i.id === ref) ?? items.find((i) => ref.startsWith(`${i.id}.`)) ?? null;
}

const isEmpty = (d: Dossier | null) => !d || (d.facts.length === 0 && d.patterns.length === 0);

// ─── quality gate ──────────────────────────────────────────────────────────

const CLOCK_TIME = /\b\d{1,2}[:.]\d{2}\b|\b\d{1,2}\s?(am|pm|a\.m\.|p\.m\.)|o'?clock\b/i;
const METRIC_WORDS =
  /\b(drift\w*|start(ing)? times?|average\w*|on average|percent\w*|per (day|week|month)|meetings? (a|per|each) (day|week)|busiest|trend\w*|metric\w*|statistic\w*|frequency|minutes?|hours?|schedul\w+ (will|density)|first activity|calendar density|settles? back|data)\b|%/i;
/** Outcome or progress claims no checkCondition can observe. */
const OVERPROMISE =
  /\b(step (closer|forward)|next step|move[sd]? (things |it |your \w+ )?(forward|ahead|along)|carr(y|ies) (your|the) \w+ (forward|further)|turns? into|leads? to|opens? (the|a) (next )?door|take[s]? shape|come[s]? together|pays? off|and (it|that|this) will)\b/i;

const EXTRAPOLATION =
  /\b(keeps?|continues?|remains?|stays?) (on )?(drifting|shifting|trending|rising|falling|climbing|getting|being)\b|\b(will|to) (keep|continue) (on )?\w+ing\b|\bcontinues? to\b|\b(will|to) (remain|stay) (the same|steady|your|at|near|around)\b|\bsettle(s|d)? (back|down)\b|\bpattern (will )?(continues?|holds?|breaks?)\b/i;
const STOP = new Set(
  'about after again also always and another any are around back been before being between both but can close could day days did does doing each even ever every for from had has have her here his how into its just keep keeps last lately like made make more most much near next not now off once one only other our out over own same she should since some still such than that the their them then there these they thing this those through time times too under until very was week weeks well were what when where which while who will with would year you your yours'.split(' '),
);
const contentWords = (text: string) =>
  new Set(
    text
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOP.has(w))
      .map((w) => w.replace(/(ing|ed|es|s)$/, '')),
  );

const REQUIRED_SOURCE: Record<DailyReadingOutput['prophecy']['checkCondition']['type'], SourceKind | null> = {
  calendar_event_with: 'calendar',
  listening_pattern: 'spotify',
  email_from_contact: 'mail',
  generic: null,
};

/**
 * Deterministic review of a grounded draft (SPEC §1): a prophecy about a life, not a restated metric, and a
 * checkCondition the sources can actually observe. Returns specific problems to feed back to the model.
 */
export function reviewDraft(output: DailyReadingOutput, ctx: Pick<ReadingContext, 'dossier' | 'sources'>, evidence: DossierFact | DossierPattern | null): string[] {
  const problems: string[] = [];
  const { observation, prophecy } = output;
  const statement = prophecy.statement;
  const sources = connectedSources(ctx);
  const contacts = new Set(dossierContacts(ctx.dossier).map((c) => c.key));

  if (/\d/.test(statement)) problems.push('The prophecy contains digits. Write it without numbers, dates or clock times.');
  else if (CLOCK_TIME.test(statement)) problems.push('The prophecy names a clock time. Speak of mornings, evenings or a day instead.');
  const metric = statement.match(METRIC_WORDS);
  if (metric) problems.push(`The prophecy uses metric language ("${metric[0]}"). Predict a moment in their life, not a measurement.`);
  const extra = statement.match(OVERPROMISE);
  if (extra) {
    problems.push(`The prophecy promises more than its checkCondition can see ("${extra[0]}"). Describe only the one event the check observes — no outcome, progress or second claim.`);
  }
  const cc0 = prophecy.checkCondition;
  if (cc0.type === 'email_from_contact' && !cc0.firstInThread && /\b(writes? first|reach(es)? out|finally)\b/i.test(statement)) {
    problems.push('The prophecy says they write first / reach out / finally, but checkCondition.firstInThread is false. Say they "write" or "reply", or set firstInThread: true.');
  }
  if (EXTRAPOLATION.test(statement)) problems.push('The prophecy only extends a trend ("keeps", "continues", "settles back"). Predict something that happens: a person, a plan, a choice, a song.');
  if (CLOCK_TIME.test(observation.text)) problems.push('The observation names a clock time. Say it the way a person would ("your mornings", "late on Sundays").');
  const obsMetric = observation.text.match(
    /\b(average\w*|on average|percent\w*|per (day|week|month)|minutes?|drift\w*|start(ing)? times?|trend\w*|busiest|(start|begin)s? (late|later|early|earlier)|(later|earlier) than (before|last|usual))\b|%|\d+\.\d+/i,
  );
  if (obsMetric) problems.push(`The observation reads like a statistic ("${obsMetric[0]}"). Notice something human instead.`);

  if (evidence) {
    const cited = 'statement' in evidence ? evidence.statement : `${evidence.label} ${evidence.value}`;
    const person = contacts.has(evidence.id.slice('people.'.length)) && 'label' in evidence ? contentWords(evidence.label) : new Set<string>();
    const factWords = contentWords(cited);
    const shared = [...contentWords(statement)].filter((w) => factWords.has(w) && !person.has(w));
    if (evidence.id.startsWith('rhythms.') || evidence.id.startsWith('pattern.') ? shared.length >= 2 : shared.length >= 3) {
      problems.push(`The prophecy restates the fact it rests on (${shared.join(', ')}). Let the observation carry the fact; the prophecy should be a new moment that follows from it.`);
    }
  }

  const cc = prophecy.checkCondition;
  const required = REQUIRED_SOURCE[cc.type];
  if (required && !sources.includes(required)) {
    problems.push(`checkCondition ${cc.type} needs ${required}, which is not connected. Connected: ${sources.join(', ') || 'none'}.`);
  }
  const word = cc.type === 'calendar_event_with' ? cc.titleIncludes : cc.type === 'email_from_contact' ? cc.subjectIncludes : null;
  const pursuitCheck = 'contact' in cc && cc.contact === 'any' && Boolean(word?.trim()) && dossierPursuits(ctx.dossier).length > 0;
  if ('contact' in cc && cc.contact === 'any' && !pursuitCheck) {
    problems.push(`checkCondition.contact "any" needs a ${cc.type === 'email_from_contact' ? 'subjectIncludes' : 'titleIncludes'} word from one of the pursuits, e.g. "interview".`);
  } else if ((cc.type === 'calendar_event_with' || cc.type === 'email_from_contact') && !pursuitCheck && !contacts.has(cc.contact)) {
    problems.push(
      contacts.size > 0
        ? `checkCondition.contact "${cc.contact}" is not a person in the dossier. Use one of: ${[...contacts].join(', ')} — or a different kind of prophecy.`
        : 'There are no people in the dossier, so the prophecy cannot be checked against a contact. Choose a listening or generic prophecy.',
    );
  }
  if (cc.type === 'listening_pattern' && (/^[\w-]+$/.test(cc.pattern.trim()) || cc.pattern.trim().split(/\s+/).length < 5)) {
    problems.push(`checkCondition.pattern "${cc.pattern}" is not a concrete, checkable listening pattern. Write a sentence Spotify data could confirm.`);
  }
  if (cc.type === 'listening_pattern' && /\b(calendar|meeting|schedul\w*|start time|busiest)\b/i.test(cc.pattern)) {
    problems.push('A listening_pattern must be about listening, not the calendar.');
  }
  if (cc.type === 'generic' && cc.description.trim().split(/\s+/).length < 5) {
    problems.push('checkCondition.description is too vague to check. Say concretely what would count.');
  }
  return problems;
}

/** `watching` = the connected sources the check needs (never a source that isn't linked). */
export function normalizeWatching(output: DailyReadingOutput, sources: SourceKind[]): DailyReadingOutput {
  const required = REQUIRED_SOURCE[output.prophecy.checkCondition.type];
  const watching = [...new Set([...(required ? [required] : []), ...output.prophecy.watching])].filter((s) => sources.includes(s));
  const fallback = sources.length > 0 ? sources.slice(0, 1) : output.prophecy.watching;
  return { ...output, prophecy: { ...output.prophecy, watching: watching.length > 0 ? watching : fallback } };
}

const MAX_ATTEMPTS = 3;

export type ProphecyVerdict = { ok: boolean; reason: string };
export type ProphecyJudge = (output: DailyReadingOutput, evidence: DossierFact | DossierPattern) => Promise<ProphecyVerdict | null>;

const JudgeOutput = z.object({
  humanNotMetric: z.boolean().describe('The prophecy is about a moment in the person\'s life (a person, a plan, a choice, a song, an evening), not a data restatement or trend forecast.'),
  hopefulAndVivid: z.boolean().describe('Hopeful or warm, and personal enough to picture the moment — a reader\'s voice (thresholds, seasons, a word from someone) is good; empty generalities that could fit anyone, ominous or sad lines are not. It should not recite company names, schedules or dates.'),
  checkMatchesStatement: z.boolean().describe('If the checkCondition came true, a reasonable person would say the prophecy came true.'),
  reason: z.string().describe('One short sentence: what to fix, or "fine".'),
});

/**
 * Cheap second opinion (Claude Haiku 4.5) on drafts that already passed the deterministic gate: is the prophecy a
 * vivid, hopeful, human moment rather than a data restatement, and does its checkCondition test what it says?
 * Returns null when the judge is unavailable (the draft is then accepted).
 */
export const judgeProphecy: ProphecyJudge = async (output, evidence) => {
  try {
    const { output: verdict } = await generateText({
      model: MODELS.summary,
      output: Output.object({ schema: JudgeOutput }),
      instructions:
        'You review one daily prophecy from Morrow, a fortune teller that reads a person\'s calendar, email and music. Good prophecies are hopeful, specific moments in a life: a person writing, something for a pursuit landing on the calendar, a plan happening, a new voice in their rotation, a free evening kept. Bad ones restate or extrapolate a statistic, are vague or abstract, or promise something the check cannot see. checkMatchesStatement: judge the core event only — if the check fires, would a reasonable person say this came true? Warm wording and small imagery ("before the week is out", "a quiet yes to an evening") are fine when the event itself matches; a second promised outcome (progress, a result, what it leads to) is not. Be strict about the event, generous about the voice.',
      prompt: `Observation: ${output.observation.text}\nFact it rests on: ${'statement' in evidence ? evidence.statement : `${evidence.label}: ${evidence.value}`}\nProphecy: ${output.prophecy.statement}\ncheckCondition: ${JSON.stringify(output.prophecy.checkCondition)}`,
      abortSignal: AbortSignal.timeout(8000),
    });
    const ok = verdict.humanNotMetric && verdict.hopefulAndVivid && verdict.checkMatchesStatement;
    return { ok, reason: verdict.reason };
  } catch (e) {
    console.warn('[morrow] prophecy judge unavailable', e instanceof Error ? e.message : e);
    return null;
  }
};

/**
 * Generates the day's opening (observation + prophecy) from the dossier with Claude Sonnet 5 structured
 * output (`DailyReadingOutput`). Every draft must pass: taboo filter, grounding (`observation.evidenceRef` names
 * a dossier fact or pattern), the deterministic quality gate (`reviewDraft`) and the Haiku judge. Failing drafts
 * are regenerated with specific feedback (up to two retries). If only the judge objected to the last drafts, the
 * last gate-passing draft is used; otherwise a safe templated reading built from a real fact. Without model
 * access: demo templates (fixtures) or the templated fallback (real data).
 */
export async function generateDailyReading(
  ctx: ReadingContext,
  options: { judge?: ProphecyJudge | null } = {},
): Promise<DailyReadingOutput> {
  if (isEmpty(ctx.dossier)) return templatedReading(ctx);
  if (!hasModelAccess()) return isDemoData() ? demoDailyReading(ctx) : templatedReading(ctx);
  const judge = options.judge === undefined ? judgeProphecy : options.judge;
  const dossier = ctx.dossier!;
  const sources = connectedSources(ctx);
  let feedback = '';
  let passedGate: DailyReadingOutput | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const { output } = await generateText({
        model: MODELS.reading,
        output: Output.object({ schema: DailyReadingOutput }),
        prompt: dailyReadingPrompt(ctx) + feedback,
      });
      const draft = `\n\nYour previous draft:\n- observation: "${output.observation.text}" (evidenceRef ${output.observation.evidenceRef})\n- prophecy: "${output.prophecy.statement}" checkCondition ${JSON.stringify(output.prophecy.checkCondition)}`;
      const evidence = resolveEvidence(dossier, output.observation.evidenceRef);
      if (!isReadingSafe(output)) {
        feedback = `${draft}\n\nIt touched a topic Morrow never reads. Choose a different fact.`;
        continue;
      }
      if (!evidence) {
        feedback = `${draft}\n\nIt cited evidenceRef "${output.observation.evidenceRef}", which is not in the dossier. Use exactly one of these ids: ${[...dossier.facts, ...dossier.patterns].map((i) => i.id).join(', ')}.`;
        continue;
      }
      const problems = reviewDraft(output, ctx, evidence);
      if (problems.length > 0) {
        console.warn(`[morrow] reading draft ${attempt + 1} rejected: ${problems.join(' | ')}`);
        feedback = `${draft}\n\nIt was rejected. Fix all of these and write a new reading:\n${problems.map((p) => `- ${p}`).join('\n')}`;
        continue;
      }
      const accepted = normalizeWatching({ ...output, observation: { ...output.observation, evidenceRef: evidence.id } }, sources);
      passedGate = accepted;
      const verdict = judge ? await judge(accepted, evidence) : null;
      if (verdict && !verdict.ok) {
        console.warn(`[morrow] reading draft ${attempt + 1} rejected by judge: ${verdict.reason}`);
        feedback = `${draft}\n\nA reviewer rejected it: ${verdict.reason} Write a new reading.`;
        continue;
      }
      return accepted;
    } catch (e) {
      console.error('[morrow] daily reading generation failed', e);
    }
  }
  return passedGate ?? templatedReading(ctx);
}

const SOURCE_NAME: Record<string, string> = { calendar: 'Calendar', spotify: 'Spotify', mail: 'Mail', instagram: 'Instagram' };

/**
 * Safe, deterministic opening grounded in one real fact (fallback for failed or unavailable generation).
 * Held to the same standard as generated readings: a human observation, a hopeful prophecy about a moment,
 * no clock times or restated metrics, and a check the connected sources can observe.
 */
export function templatedReading(ctx: Pick<ReadingContext, 'dossier' | 'localDate' | 'sources'>): DailyReadingOutput {
  const dossier = ctx.dossier;
  if (!dossier || isEmpty(dossier)) return demoDailyReading(ctx);
  const sources = connectedSources(ctx);
  const has = (kind: SourceKind) => sources.includes(kind);
  const pick = (id: string) => dossier.facts.find((f) => f.id === id && f.sources.every(has));
  const fact =
    (has('calendar') ? dossier.facts.find((f) => f.id.startsWith('people.') && f.value.startsWith('Moved')) : undefined) ??
    (has('calendar') ? dossier.facts.find((f) => f.id.startsWith('people.')) : undefined) ??
    pick('rhythms.protected_time') ??
    pick('tastes.new_in_rotation') ??
    pick('rhythms.late_nights') ??
    pick('tastes.top_artists') ??
    pick('rhythms.slipping_slot') ??
    pick('rhythms.first_activity') ??
    dossier.facts[0];
  if (!fact) return demoDailyReading({ dossier: null, localDate: ctx.localDate });

  const sourceLabel = `${fact.sources.map((s) => SOURCE_NAME[s] ?? s).join(' · ')} · ${fact.id.startsWith('people.') ? (fact.value.match(/\d\d\.\d\d/g)?.slice(-3).join(' · ') ?? 'lately') : 'lately'}`;
  const contact = fact.id.startsWith('people.') ? fact.id.slice('people.'.length) : null;
  const generic = (description: string): DailyReadingOutput['prophecy']['checkCondition'] => ({ type: 'generic', description });
  const listening = (pattern: string): DailyReadingOutput['prophecy']['checkCondition'] =>
    has('spotify') ? { type: 'listening_pattern', pattern } : generic(pattern);

  const reading = ((): { text: string; statement: string; checkCondition: DailyReadingOutput['prophecy']['checkCondition']; windowDays: number; likelihood: number } => {
    if (contact) {
      return fact.value.startsWith('Moved')
        ? {
            text: `${fact.label} keeps moving on your calendar, and it is rarely about ${fact.label}.`,
            statement: `The plan with ${fact.label} that keeps sliding will finally happen.`,
            checkCondition: { type: 'calendar_event_with', contact, titleIncludes: null },
            windowDays: 14,
            likelihood: 0.55,
          }
        : {
            text: `You keep making time for ${fact.label}, even in the full weeks.`,
            statement: `${fact.label} will be the one to suggest getting together next, before you get the chance to ask.`,
            checkCondition: { type: 'calendar_event_with', contact, titleIncludes: null },
            windowDays: 14,
            likelihood: 0.5,
          };
    }
    switch (fact.id) {
      case 'rhythms.protected_time':
        return {
          text: 'You guard one slot more carefully than anything else on your calendar.',
          statement: 'Someone will ask for that time, and you will keep it for yourself without apologising.',
          checkCondition: generic('The protected recurring slot stays on the calendar, unmoved, through the window.'),
          windowDays: 7,
          likelihood: 0.6,
        };
      case 'tastes.new_in_rotation':
        return {
          text: 'A few new voices have moved into your rotation this season.',
          statement: 'One of the new voices will become the song you reach for on a good evening.',
          checkCondition: listening('an artist not in their top artists of the last six months reaches their top five'),
          windowDays: 21,
          likelihood: 0.5,
        };
      case 'rhythms.late_nights':
        return {
          text: 'The music runs later than you think, mostly when the day finally goes quiet.',
          statement: 'A song from those quiet stretches after dark will turn up again on an ordinary afternoon.',
          checkCondition: listening('a track first played late at night is played again in the daytime'),
          windowDays: 10,
          likelihood: 0.5,
        };
      case 'tastes.top_artists':
        return {
          text: 'The music you keep close lately says something about the season you are in.',
          statement: 'Someone new will slip into your rotation before the month turns.',
          checkCondition: listening('an artist not in their top artists of the last sixty days reaches their top five'),
          windowDays: 21,
          likelihood: 0.45,
        };
      case 'rhythms.slipping_slot':
        return {
          text: 'One recurring slot keeps giving way to everything else.',
          statement: 'This week you will let that slot go on purpose, and use the time for something you actually want.',
          checkCondition: generic('The slipping recurring slot is moved or cancelled, and the time is not refilled with another meeting.'),
          windowDays: 7,
          likelihood: 0.45,
        };
      case 'rhythms.first_activity':
        return {
          text: 'Your mornings have a shape you may not have noticed.',
          statement: 'One day this week you will give yourself a slow beginning, and nothing will suffer for it.',
          checkCondition: generic('One weekday has no calendar event or play before late morning.'),
          windowDays: 7,
          likelihood: 0.5,
        };
      default:
        return {
          text: 'Your days have a rhythm worth watching.',
          statement: 'Something small this week will be worth telling me about.',
          checkCondition: generic('A new event or play appears that breaks from the usual week.'),
          windowDays: 7,
          likelihood: 0.45,
        };
    }
  })();

  return normalizeWatching(
    {
      observation: { text: findTaboo(reading.text) ? 'Your days have a rhythm worth watching.' : reading.text, evidenceRef: fact.id, sourceLabel },
      prophecy: {
        statement: reading.statement,
        checkCondition: reading.checkCondition,
        windowDays: reading.windowDays,
        likelihood: reading.likelihood,
        watching: fact.sources.length > 0 ? fact.sources : sources,
      },
    },
    sources.length > 0 ? sources : fact.sources,
  );
}

type DemoTemplate = { match: (d: Dossier) => boolean; build: (d: Dossier) => DailyReadingOutput };

const DEMO_TEMPLATES: DemoTemplate[] = [
  {
    match: (d) => d.facts.some((f) => f.id === 'rhythms.protected_time'),
    build: (d) => {
      const fact = d.facts.find((f) => f.id === 'rhythms.protected_time');
      return {
        observation: {
          text: 'You guard Thursday mornings more carefully than anything else on your calendar.',
          evidenceRef: 'dossier.rhythms.protected_time',
          sourceLabel: `Calendar · ${fact?.value ?? 'Thursday mornings'}`,
        },
        prophecy: {
          statement: 'Someone will ask for your Thursday, and you will say yes on your own terms.',
          checkCondition: { type: 'calendar_event_with', contact: 'any', titleIncludes: null },
          windowDays: 14,
          likelihood: 0.55,
          watching: ['calendar'],
        },
      };
    },
  },
  {
    match: (d) => d.patterns.length > 0,
    build: (d) => {
      const p = d.patterns[0]!;
      return {
        observation: { text: p.statement, evidenceRef: `dossier.${p.id}`, sourceLabel: p.sources.map(cap).join(' · ') },
        prophecy: {
          statement: 'This week you will make one small choice that surprises you.',
          checkCondition: { type: 'generic', description: `A day that contradicts: ${p.statement}` },
          windowDays: 7,
          likelihood: 0.5,
          watching: p.sources.length > 0 ? p.sources : ['calendar'],
        },
      };
    },
  },
];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Deterministic, dossier-grounded reading used in demo mode and as a fallback. */
export function demoDailyReading(ctx: Pick<ReadingContext, 'dossier' | 'localDate'>): DailyReadingOutput {
  const dossier = ctx.dossier;
  const candidates = dossier ? DEMO_TEMPLATES.filter((t) => t.match(dossier)) : [];
  if (dossier && candidates.length > 0) {
    const day = Number(ctx.localDate.slice(-2));
    return candidates[day % candidates.length]!.build(dossier);
  }
  return {
    observation: {
      text: 'Your days are quiet enough that I can barely read them yet.',
      evidenceRef: 'dossier.empty',
      sourceLabel: 'No sources linked',
    },
    prophecy: {
      statement: 'Something small this week will be worth telling me about.',
      checkCondition: { type: 'generic', description: 'Any new linked source produces an event.' },
      windowDays: 7,
      likelihood: 0.4,
      watching: ['calendar'],
    },
  };
}

function transcript(messages: Message[]): string {
  return messages
    .map((m) => {
      const text = m.parts
        .map((p) => (p.type === 'text' || p.type === 'observation' ? p.text : p.type === 'prophecyRef' ? `[prophecy ${p.prophecyId} ${p.event}]` : ''))
        .filter(Boolean)
        .join(' ');
      return `${m.role === 'user' ? 'Person' : 'Morrow'}: ${text}`;
    })
    .join('\n');
}

/** Memory summary written when a reading is sealed (Haiku 4.5, deterministic fallback). */
export async function summarizeReading(user: User, reading: Reading, messages: Message[]): Promise<string> {
  const fallback = () => {
    const made = reading.prophecyId ? ` Prophecy ${formatProphecyNumber(Number(reading.prophecyId.slice(2)))} made.` : '';
    const asked = reading.questionCount === 1 ? '1 question' : `${reading.questionCount} questions`;
    return `Morrow saw: ${reading.headline} ${user.name} asked ${asked}.${made}`;
  };
  if (!hasModelAccess() || messages.length === 0) return fallback();
  try {
    const { text } = await generateText({
      model: MODELS.summary,
      instructions: SUMMARY_INSTRUCTIONS,
      prompt: `Person: ${user.name}\nReading ${reading.localDate}\n\n${transcript(messages)}`,
    });
    const summary = text.trim();
    return summary && !findTaboo(summary) ? summary : fallback();
  } catch (e) {
    console.error('[morrow] summary failed', e);
    return fallback();
  }
}
