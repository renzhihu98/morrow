import { SourceKind, type DossierFact, type DossierPattern } from '@morrow/core';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { MODELS } from '../ai/models';
import { findTaboo } from '../ai/taboo';
import { hasModelAccess } from '../server/env';

const PatternOutput = z.object({
  patterns: z
    .array(
      z.object({
        key: z.string().describe('snake_case slug, e.g. "music_after_long_days"'),
        statement: z.string().describe('One plain sentence in second person, max 14 words.'),
        confidence: z.number().min(0).max(1),
        factIds: z.array(z.string()).min(1).describe('Ids of the facts this pattern rests on.'),
      }),
    )
    .max(3),
});

/** Patterns feed readings; ones that read like analytics are dropped rather than passed on. */
const METRIC_SPEAK = /\b(shift\w*|drift\w*|start(ing)? times?|average\w*|percent\w*|minutes?|per (day|week|month))\b|\d{1,2}:\d{2}|%/i;

const INSTRUCTIONS = `You infer patterns for Morrow, a fortune teller that reads a person's own calendar and listening data.
Given distilled facts (never raw events), propose at most three patterns that connect two or more facts or read between the lines of one.
- Each pattern must follow from the cited facts. No invention of people, dates or counts.
- Read the life, not the metric: who they make time for, what they protect, what keeps slipping, what the music says about the season they're in.
- No clock times, averages, minute counts, percentages or words like "shift", "drift" or "start time". Say "mornings", "late on Sundays", "the full weeks".
- Plain second-person sentences ("You …"), calm, no mysticism, max 14 words.
- Confidence honest: 0.4–0.8 unless the facts are overwhelming.
- Never mention health, sleep problems, pregnancy, death, money stress or relationships ending.
- If the facts are too thin, return an empty list.`;

/**
 * Inferred patterns via Claude Haiku 4.5 structured output. Only facts go in; every pattern must cite
 * existing fact ids. Without model access (or on failure) the previous patterns are kept, filtered to facts
 * that still exist.
 */
export async function inferPatterns(facts: DossierFact[], previous: DossierPattern[], forgotten: string[]): Promise<DossierPattern[]> {
  const keepPrevious = () => previous.filter((p) => !forgotten.includes(p.id) && p.sources.length > 0);
  if (facts.length < 2 || !hasModelAccess()) return facts.length === 0 ? [] : keepPrevious();
  try {
    const { output } = await generateText({
      model: MODELS.summary,
      instructions: INSTRUCTIONS,
      output: Output.object({ schema: PatternOutput }),
      prompt: facts.map((f) => `- [${f.id}] (${f.category}) ${f.label}: ${f.value} — sources: ${f.sources.join(', ')}`).join('\n'),
    });
    const byId = new Map(facts.map((f) => [f.id, f]));
    return output.patterns.flatMap((p): DossierPattern[] => {
      const cited = p.factIds.map((id) => byId.get(id)).filter((f): f is DossierFact => Boolean(f));
      const id = `pattern.${p.key.toLowerCase().replace(/[^a-z0-9_]+/g, '_').slice(0, 48)}`;
      if (cited.length === 0 || findTaboo(p.statement) || METRIC_SPEAK.test(p.statement) || forgotten.includes(id)) return [];
      const sources = [...new Set(cited.flatMap((f) => f.sources))].filter((s) => SourceKind.safeParse(s).success);
      return [{ id, statement: p.statement.trim(), confidence: Math.round(p.confidence * 100) / 100, sources }];
    });
  } catch (e) {
    console.error('[morrow] pattern inference failed', e);
    return keepPrevious();
  }
}
