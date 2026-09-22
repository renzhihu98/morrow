import type { DailyReadingOutput } from '@morrow/core';

/**
 * Voice v0.4 — concise (SPEC §1 "Voice"). Morrow's replies render as chat bubbles in body text, so they must read
 * like short chat messages. These limits are shared by the prompts, the deterministic gates and the eval rubric.
 * The prompts ask for a little less than the gates allow, so a good draft never sits on the edge.
 */
export const VOICE_LIMITS = {
  /** Chat `observe` headline — the first paragraph of the bubble. */
  headline: { sentences: 2, words: 25 },
  /** Plain text after the headline — the optional second paragraph (the sign to watch for). */
  followUp: { sentences: 2, words: 25 },
  /** The whole chat answer. */
  answerWords: 45,
  /** Opening reading observation. */
  observation: { sentences: 2, words: 20 },
  /** The prophecy statement is always one sentence. */
  prophecy: { sentences: 1, words: 22 },
} as const;

/** Openers that delay the reading ("Ah,", "I sense that…", restating the question). */
const PREAMBLE =
  /^\s*((ah|oh|mm+|hmm+|well|so)\b[,.…]|i sense that\b|i feel that\b|let me\b|you asked\b|you('re| are) asking\b|you want to know\b|great question\b|what a (question|lovely)\b|that'?s a (good|great|lovely|beautiful) question\b)/i;

const SENTENCE = /[^.!?…]+(?:[.!?…]+["')\]]*|$)\s*/g;

export const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

export const splitSentences = (text: string): string[] => (text.match(SENTENCE) ?? []).map((s) => s.trim()).filter(Boolean);

/** Keeps the first `max` sentences (used when a second over-long draft still has to be shown). */
export const firstSentences = (text: string, max: number) => splitSentences(text).slice(0, max).join(' ');

/** Problems with one piece of Morrow's text against a sentence/word budget. Empty = it reads fine. */
export function reviewConcise(text: string, limit: { sentences: number; words: number }, what: string): string[] {
  const problems: string[] = [];
  const words = wordCount(text);
  const sentences = splitSentences(text).length;
  if (words > limit.words) problems.push(`The ${what} is ${words} words. Keep it under ${limit.words}: one idea per sentence, plain words.`);
  if (sentences > limit.sentences) {
    problems.push(`The ${what} has ${sentences} sentences. Use ${limit.sentences === 1 ? 'exactly one' : `at most ${limit.sentences}`}.`);
  }
  if (text.includes(';')) problems.push(`The ${what} chains clauses with a semicolon. Split it into short sentences.`);
  const opener = text.match(PREAMBLE);
  if (opener) problems.push(`The ${what} opens with "${opener[0].trim()}". Start with the reading itself, no preamble.`);
  return problems;
}

/** Length and readability of the opening reading (the rest of the gate is `reviewDraft`). */
export function reviewReadingLength(output: DailyReadingOutput): string[] {
  return [
    ...reviewConcise(output.observation.text, VOICE_LIMITS.observation, 'observation'),
    ...reviewConcise(output.prophecy.statement, VOICE_LIMITS.prophecy, 'prophecy'),
  ];
}
