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
  type User,
} from '@morrow/core';
import { generateText, Output } from 'ai';
import { hasModelAccess, isDemoData } from '../server/env';
import { MODELS } from './models';
import { dailyReadingPrompt, SUMMARY_INSTRUCTIONS } from './prompts';
import { findTaboo, isReadingSafe } from './taboo';

export type ReadingContext = {
  user: User;
  now: Date;
  localDate: string;
  dossier: Dossier | null;
  summaries: ReadingSummary[];
  prophecies: Prophecy[];
};

/** Dossier ids may be cited with or without the `dossier.` prefix, and with a sub-path (`people.sam.moves`). */
export function resolveEvidence(dossier: Dossier | null, evidenceRef: string): DossierFact | DossierPattern | null {
  if (!dossier) return null;
  const ref = evidenceRef.trim().replace(/^dossier\./, '');
  const items: (DossierFact | DossierPattern)[] = [...dossier.facts, ...dossier.patterns];
  return items.find((i) => i.id === ref) ?? items.find((i) => ref.startsWith(`${i.id}.`)) ?? null;
}

const isEmpty = (d: Dossier | null) => !d || (d.facts.length === 0 && d.patterns.length === 0);

/**
 * Generates the day's opening (observation + prophecy) from the dossier with Claude Sonnet 5 structured
 * output (`DailyReadingOutput`). Grounding check: `observation.evidenceRef` must name a dossier fact or
 * pattern and nothing may touch a taboo topic — otherwise regenerate once with feedback, then fall back to
 * a safe templated observation built from a real fact. Without model access: demo templates (fixtures)
 * or the templated fallback (real data).
 */
export async function generateDailyReading(ctx: ReadingContext): Promise<DailyReadingOutput> {
  if (isEmpty(ctx.dossier)) return templatedReading(ctx);
  if (!hasModelAccess()) return isDemoData() ? demoDailyReading(ctx) : templatedReading(ctx);
  const dossier = ctx.dossier!;
  let feedback = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { output } = await generateText({
        model: MODELS.reading,
        output: Output.object({ schema: DailyReadingOutput }),
        prompt: dailyReadingPrompt(ctx) + feedback,
      });
      const evidence = resolveEvidence(dossier, output.observation.evidenceRef);
      if (!isReadingSafe(output)) {
        feedback = '\n\nYour previous draft touched a topic Morrow never reads. Choose a different fact.';
        continue;
      }
      if (!evidence) {
        feedback = `\n\nYour previous draft cited evidenceRef "${output.observation.evidenceRef}", which is not in the dossier. Use exactly one of these ids: ${[...dossier.facts, ...dossier.patterns].map((i) => i.id).join(', ')}.`;
        continue;
      }
      return { ...output, observation: { ...output.observation, evidenceRef: evidence.id } };
    } catch (e) {
      console.error('[morrow] daily reading generation failed', e);
    }
  }
  return templatedReading(ctx);
}

const SOURCE_NAME: Record<string, string> = { calendar: 'Calendar', spotify: 'Spotify', mail: 'Mail', instagram: 'Instagram' };

/** Safe, deterministic opening grounded in one real fact (fallback for failed or unavailable generation). */
export function templatedReading(ctx: Pick<ReadingContext, 'dossier' | 'localDate'>): DailyReadingOutput {
  const dossier = ctx.dossier;
  if (!dossier || isEmpty(dossier)) return demoDailyReading(ctx);
  const demo = DEMO_TEMPLATES.filter((t) => t.match(dossier));
  const pick = (prefix: string) => dossier.facts.find((f) => f.id.startsWith(prefix));
  const fact =
    dossier.facts.find((f) => f.id.startsWith('people.') && f.value.startsWith('Moved')) ??
    pick('rhythms.protected_time') ??
    pick('rhythms.slipping_slot') ??
    pick('rhythms.first_activity') ??
    pick('rhythms.late_nights') ??
    dossier.facts[0];
  if (!fact) return demo[0]?.build(dossier) ?? demoDailyReading({ dossier: null, localDate: ctx.localDate });

  const sourceLabel = `${fact.sources.map((s) => SOURCE_NAME[s] ?? s).join(' · ')} · ${fact.value}`.slice(0, 90);
  const contact = fact.id.startsWith('people.') ? fact.id.slice('people.'.length) : null;
  const text = contact
    ? fact.value.startsWith('Moved')
      ? `${fact.label} keeps moving on your calendar, and it is rarely about ${fact.label}.`
      : `You keep making time for ${fact.label}.`
    : fact.id === 'rhythms.protected_time'
      ? 'You guard one slot more carefully than anything else on your calendar.'
      : fact.id === 'rhythms.slipping_slot'
        ? 'One recurring slot keeps giving way to everything else.'
        : fact.id === 'rhythms.first_activity'
          ? 'Your mornings have a shape you may not have noticed.'
          : fact.id === 'rhythms.late_nights'
            ? 'The music runs later than you think.'
            : `${fact.label}: ${fact.value}.`;

  return {
    observation: { text: findTaboo(text) ? 'Your days have a rhythm worth watching.' : text, evidenceRef: fact.id, sourceLabel },
    prophecy: contact
      ? {
          statement: `${fact.label} will be on your calendar again within two weeks.`,
          checkCondition: { type: 'calendar_event_with', contact, titleIncludes: null },
          windowDays: 14,
          likelihood: 0.55,
          watching: ['calendar'],
        }
      : {
          statement: 'This week the pattern will break once, and you will notice.',
          checkCondition: { type: 'generic', description: `A day that contradicts: ${fact.label} — ${fact.value}` },
          windowDays: 7,
          likelihood: 0.5,
          watching: fact.sources.length > 0 ? fact.sources : ['calendar'],
        },
  };
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
          statement: 'This week the pattern will break once, and you will notice.',
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
