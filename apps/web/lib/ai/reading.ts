import {
  DailyReadingOutput,
  formatProphecyNumber,
  type Dossier,
  type Message,
  type Prophecy,
  type Reading,
  type ReadingSummary,
  type User,
} from '@morrow/core';
import { generateText, Output } from 'ai';
import { hasModelAccess } from '../server/env';
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

/**
 * Generates the day's opening (observation + prophecy) from the dossier with structured output.
 * Falls back to a deterministic demo reading without model access, on failure, or when the model
 * twice produces something the taboo filter rejects.
 */
export async function generateDailyReading(ctx: ReadingContext): Promise<DailyReadingOutput> {
  if (!hasModelAccess() || !ctx.dossier) return demoDailyReading(ctx);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { output } = await generateText({
        model: MODELS.reading,
        output: Output.object({ schema: DailyReadingOutput }),
        prompt: dailyReadingPrompt(ctx),
      });
      const evidenceExists =
        ctx.dossier.facts.some((f) => output.observation.evidenceRef.includes(f.id)) ||
        ctx.dossier.patterns.some((p) => output.observation.evidenceRef.includes(p.id));
      if (isReadingSafe(output) && evidenceExists) return output;
    } catch (e) {
      console.error('[morrow] daily reading generation failed', e);
    }
  }
  return demoDailyReading(ctx);
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
