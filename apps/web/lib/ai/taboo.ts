import { TABOO_TOPICS, type DailyReadingOutput, type TabooTopic } from '@morrow/core';

/**
 * Post-generation taboo filter (SPEC §1.6). The system prompt forbids these topics; this is the
 * belt-and-braces check that runs on everything Morrow says before it reaches the user or storage.
 * Patterns are deliberately broad: a false positive costs one softer sentence, a miss costs trust.
 */
const PATTERNS: Record<TabooTopic, RegExp> = {
  health:
    /\b(ill(ness)?|sick(ness)?|disease|diagnos\w*|symptom\w*|cancer|tumou?r|doctor|hospital\w*|therap(y|ist)|medicat\w*|depress\w*|anxiety|panic attack|insomnia|injur\w*|surgery|mental health|burn(ed|t)?[- ]?out|dentist\w*|dental|clinic|physio\w*|psychiatr\w*|dermatolog\w*|check-?up)\b/i,
  pregnancy: /\b(pregnan\w*|expecting a (baby|child)|conceiv\w*|fertility|miscarr\w*|ivf|trimester|due date)\b/i,
  death: /\b(die[sd]?|dying|death|dead|funeral|grie(f|ving)|pass(es|ed)? away|mortal\w*|suicid\w*|terminal)\b/i,
  money_stress:
    /\b(debt|broke|bankrupt\w*|overdra\w*|can'?t afford|money (trouble|stress|worries|problems)|rent (is )?late|evict\w*|loan shark|financial (stress|trouble|ruin|hardship))\b/i,
  relationship_breakdown:
    /\b(break(ing)?[- ]?up|broke up|divorc\w*|separat(e|ed|ion) from|cheat(ing|ed)? on|affair|infidelity|leav(e|ing) (you|your partner|him|her)|falling out of love|end(ing)? (the|your) relationship)\b/i,
};

export function findTaboo(text: string): TabooTopic | null {
  for (const topic of TABOO_TOPICS) if (PATTERNS[topic].test(text)) return topic;
  return null;
}

const SENTENCE = /[^.!?…]+[.!?…]*["')\]]*\s*/g;

/** Removes whole sentences that touch a taboo topic. Returns the cleaned text and what was removed. */
export function scrubTaboo(text: string): { text: string; removed: TabooTopic[] } {
  const removed: TabooTopic[] = [];
  const kept = (text.match(SENTENCE) ?? [text]).filter((sentence) => {
    const hit = findTaboo(sentence);
    if (hit) removed.push(hit);
    return !hit;
  });
  return { text: kept.join('').trim(), removed };
}

/** True when neither the observation nor the prophecy touches a taboo topic. */
export function isReadingSafe(output: DailyReadingOutput): boolean {
  const cc = output.prophecy.checkCondition;
  const conditionText = cc.type === 'generic' ? cc.description : cc.type === 'listening_pattern' ? cc.pattern : '';
  return ![output.observation.text, output.prophecy.statement, conditionText].some((t) => findTaboo(t));
}

/** Gentle line used when a whole answer had to be withheld. */
export const TABOO_DEFLECTION =
  "That's not something I read. Ask me about your days — who you make time for, what keeps moving.";
