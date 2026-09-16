import { formatProphecyNumber, type ProphecyRecord } from '@morrow/core';
import type { UIMessageStreamWriter } from 'ai';
import type { MorrowUIMessage, ObservationData, StepData } from '../chat-types';
import { numberWord } from '../ui/format';

type Script = {
  steps: Omit<StepData, 'status'>[];
  observation: ObservationData;
  text: string;
};

export type DemoContext = { question: string; record: ProphecyRecord; name: string };

const SAM: Script = {
  steps: [
    { id: 'calendar', source: 'calendar', label: 'Calendar', detail: '4 moved coffees, all on Mondays' },
    { id: 'spotify', source: 'spotify', label: 'Spotify', detail: 'What you played the nights before…' },
    { id: 'memory', source: 'memory', label: 'Past readings', detail: '09.16 — what you asked last time' },
  ],
  observation: {
    text: "Yes. But choose the day yourself — Thursday morning is open, and you haven't cancelled a Thursday since June.",
    evidenceRef: 'dossier.rhythms.protected_time',
    sourceLabel: 'Calendar · 11 Thursdays kept since 06.05 · Spotify · 4 late sessions',
  },
  text: 'The four times it slipped were all Mondays, each after a late night. It was never about Sam.',
};

function pickScript({ question, record, name }: DemoContext): Script {
  const q = question.toLowerCase();
  if (/write back|reply|respond|answer (him|her|them|sam)/.test(q)) {
    return {
      steps: [
        { id: 'mail', source: 'mail', label: 'Mail', detail: "Sam's note — 08:47, three lines" },
        { id: 'calendar', source: 'calendar', label: 'Calendar', detail: 'Thursday morning, still open' },
        { id: 'memory', source: 'memory', label: 'Past readings', detail: '09.16 — the four moved coffees' },
      ],
      observation: {
        text: 'Keep it short, and offer Thursday morning before anything else fills it.',
        evidenceRef: 'dossier.people.sam',
        sourceLabel: 'Mail · 09.30 · 08:47 · Calendar · Thursday open',
      },
      text: `Sam wrote first because the door was already open, ${name}. You don't need to explain the moved coffees.`,
    };
  }
  if (/track record|record|how often|accurate|right/.test(q)) {
    const total = record.fulfilled + record.open + record.expired;
    return {
      steps: [
        { id: 'prophecies', source: 'memory', label: 'Prophecies', detail: `${total} made since August` },
        { id: 'mail', source: 'mail', label: 'Mail', detail: 'Which ones landed in your inbox' },
        { id: 'calendar', source: 'calendar', label: 'Calendar', detail: 'Which windows closed' },
      ],
      observation: {
        text: `${cap(numberWord(record.fulfilled))} of ${numberWord(total)} have landed. ${cap(numberWord(record.expired))} closed quietly, and ${numberWord(record.open)} are still open.`,
        evidenceRef: 'prophecies.record',
        sourceLabel: `Prophecies · ${formatProphecyNumber(41)} → ${formatProphecyNumber(40 + total)}`,
      },
      text: 'The ones about people land more often than the ones about plans.',
    };
  }
  if (/next|coming|ahead|tomorrow|week/.test(q)) {
    return {
      steps: [
        { id: 'mail', source: 'mail', label: 'Mail', detail: 'The old studio — 3 threads since 09.20' },
        { id: 'calendar', source: 'calendar', label: 'Calendar', detail: 'The next two weeks' },
        { id: 'memory', source: 'memory', label: 'Past readings', detail: 'Open prophecies' },
      ],
      observation: {
        text: 'Watch the old studio. The threads are warming, and they are not about coffee.',
        evidenceRef: 'dossier.people.old_studio',
        sourceLabel: 'Mail · 09.20 · 09.22 · 09.23',
      },
      text: 'Prophecy 0052 is open until 10.30. Keep one Thursday morning free for it.',
    };
  }
  return SAM;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => (clearTimeout(t), resolve()), { once: true });
  });

/**
 * Scripted Morrow answer (SPEC §10 demo mode): the same data parts as the model path,
 * with small delays so both clients look identical with or without a model.
 */
export async function writeDemoAnswer(
  writer: UIMessageStreamWriter<MorrowUIMessage>,
  ctx: DemoContext,
  signal?: AbortSignal,
): Promise<void> {
  const { steps, observation, text } = pickScript(ctx);
  const emit = (i: number, status: StepData['status']) => {
    const step = steps[i];
    if (step) writer.write({ type: 'data-step', id: step.id, data: { ...step, status } });
  };

  // Calendar done → Spotify active → Past readings pending, then settle.
  steps.forEach((_, i) => emit(i, i === 0 ? 'active' : 'pending'));
  for (let i = 0; i < steps.length; i++) {
    await sleep(i === 0 ? 700 : 1100, signal);
    if (signal?.aborted) return;
    emit(i, 'done');
    emit(i + 1, 'active');
  }
  await sleep(400, signal);
  if (signal?.aborted) return;

  writer.write({ type: 'data-observation', id: 'answer', data: observation });
  await sleep(250, signal);

  const id = 'text-1';
  writer.write({ type: 'text-start', id });
  for (const word of text.split(/(?<= )/)) {
    if (signal?.aborted) break;
    writer.write({ type: 'text-delta', id, delta: word });
    await sleep(35, signal);
  }
  writer.write({ type: 'text-end', id });
}
