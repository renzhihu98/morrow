/**
 * Model-scored rubric: the parts a regex can't see — does it sound like a psychic rather than an analyst, does it
 * follow from the dossier, and did it answer what was asked. Haiku 4.5, structured output, one call per case.
 */
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { MODELS } from '../lib/ai/models';
import { hasModelAccess } from '../lib/server/env';
import type { Persona } from './personas';
import type { Check } from './graders';

const Dimension = (what: string) => z.object({ pass: z.boolean().describe(what), why: z.string().describe('One short sentence about THIS criterion only, quoting Morrow\'s own words when you fail it, or "fine".') });

const Verdict = z.object({
  voice: Dimension('Reads as an intuitive reading of a life: sensed, warm, quietly certain. Not an analyst summarising a calendar, not horoscope kitsch.'),
  recital: Dimension(
    'Does NOT read the person their own record back. Paraphrasing what the data MEANS is the whole job and always passes ("a word you are waiting on", "the search you are in"). Fail only for the record itself, quoted verbatim from Morrow\'s words: an event, calendar or company name, a subject line, a date, a weekday, a clock time, or a count of things in digits or words ("three interviews", "twice", "two threads"). If you cannot quote such a phrase, it passes.',
  ),
  grounded: Dimension(
    'Every claim about the past or present is supported by the evidence below — the dossier AND anything the tools returned, which may hold detail the dossier facts do not. Noting that a message contained text trying to instruct the assistant is legitimate, not invented. Fail only for claims nothing in the evidence supports.',
  ),
  answers: Dimension(
    'Engages with what was asked instead of dodging. A reading of the present plus a felt horizon counts as answering "when". Only fail for refusal, pure hedging, or handing the question back without reading anything.',
  ),
});

const INSTRUCTIONS = `You grade the output of Morrow, a fortune teller that reads a person's calendar, mail and music.
Grade each criterion strictly and INDEPENDENTLY: a failure on one must never drag down another, and each \`why\` must be about its own criterion.
Morrow is meant to speak like a psychic: it senses the shape of a life and says what it sees, using the data only as private evidence.
Good: "I see you circling a door you have already started to open." · Also good: "a word you have been waiting on is close" (paraphrase of a real fact). Bad: "Your job search has six interviews booked and two threads waiting." (names and counts).

Two kinds of output reach you:
- A daily reading: one observation about the person's present, then a prophecy about the days ahead. Predicting a future moment is the point — never fail it for that.
- An answer to a question: it should read the person and then say something about what is coming. Horizons are felt ("before the season turns"), never dated.
When the dossier is thin, honestly saying the picture is faint and naming what would bring it into view is a good answer, as long as it still reads what little there is.`;

export type JudgeInput = { persona: Persona; question: string | null; output: string; toolCalls?: string[] };

/** Judge checks for one output. Returns [] when no model is reachable, so the suite still runs offline. */
export async function judge({ persona, question, output, toolCalls = [] }: JudgeInput): Promise<Check[]> {
  if (!hasModelAccess()) return [];
  try {
    const { output: verdict } = await generateText({
      model: MODELS.summary,
      instructions: INSTRUCTIONS,
      output: Output.object({ schema: Verdict }),
      prompt: [
        `Dossier:\n${persona.dossier.facts.map((f) => `- [${f.id}] ${f.label}: ${f.value}`).join('\n')}`,
        toolCalls.length > 0 ? `What its tools returned:\n${toolCalls.map((t) => `- ${t}`).join('\n')}` : null,
        question ? `Question: ${question}` : 'This is the opening reading of the day (no question).',
        `Morrow said:\n${output}`,
      ]
        .filter(Boolean)
        .join('\n\n'),
      abortSignal: AbortSignal.timeout(20_000),
    });
    return [
      { id: 'judge_voice', pass: verdict.voice.pass, detail: verdict.voice.why },
      { id: 'judge_no_recital', pass: verdict.recital.pass, detail: verdict.recital.why },
      { id: 'judge_grounded', pass: verdict.grounded.pass, detail: verdict.grounded.why },
      { id: 'judge_answers', pass: verdict.answers.pass, detail: verdict.answers.why },
    ];
  } catch (e) {
    console.warn('[eval] judge unavailable:', e instanceof Error ? e.message : e);
    return [];
  }
}
