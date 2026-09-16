import { formatLocalTime, type Message, type Prophecy } from '@morrow/core';
import type { StepData } from '@/lib/chat-types';
import { EvidenceLine, TurnLabel } from './Labels';
import { ProphecyPanel } from './Prophecy';
import { ReadingSteps } from './ReadingSteps';

/** A message normalised for display — from storage (Message) or from the live stream (UIMessage). */
export type Turn = {
  id: string;
  role: 'user' | 'assistant';
  time: string;
  /** User text, or Morrow's serif headline (observation or first text). */
  headline: string;
  body: string[];
  sourceLabel: string | null;
  prophecyRefs: { prophecyId: string; event: 'made' | 'fulfilled' }[];
  steps: StepData[];
};

export function turnFromMessage(m: Message, timeZone: string): Turn {
  const texts: string[] = [];
  let observation: { text: string; sourceLabel: string } | null = null;
  const prophecyRefs: Turn['prophecyRefs'] = [];
  const steps: StepData[] = [];
  for (const p of m.parts) {
    if (p.type === 'text') texts.push(p.text);
    else if (p.type === 'observation') observation ??= p;
    else if (p.type === 'prophecyRef') prophecyRefs.push({ prophecyId: p.prophecyId, event: p.event });
    else if (p.type === 'steps')
      p.items.forEach((s, i) => steps.push({ id: `${m.id}-${i}`, source: s.source ?? 'memory', label: s.label, detail: '', status: s.status }));
  }
  const headline = observation?.text ?? texts.shift() ?? '';
  return {
    id: m.id,
    role: m.role,
    time: formatLocalTime(m.createdAt, timeZone),
    headline,
    body: texts,
    sourceLabel: observation?.sourceLabel ?? null,
    prophecyRefs,
    steps,
  };
}

type TurnViewProps = {
  turn: Turn;
  prophecies: Prophecy[];
  timeZone: string;
  /** Show made/fulfilled prophecy panels. */
  showProphecies?: boolean;
};

/** One turn: YOU line or Morrow's serif answer + body + SOURCE + prophecy panels. */
export function TurnView({ turn, prophecies, timeZone, showProphecies = true }: TurnViewProps) {
  if (turn.role === 'user') {
    return (
      <div className="flex flex-col gap-2">
        <TurnLabel who="you" time={turn.time} />
        <p className="text-body-m text-text-primary lg:text-body">{turn.headline}</p>
      </div>
    );
  }
  const panels = showProphecies
    ? turn.prophecyRefs
        .map((ref) => prophecies.find((p) => p.id === ref.prophecyId))
        .filter((p): p is Prophecy => Boolean(p))
    : [];
  return (
    <div className="flex flex-col gap-9">
      {turn.headline && (
        <div className="flex flex-col gap-3">
          <TurnLabel who="morrow" time={turn.time} />
          <p className="font-serif text-answer-m lg:max-w-[680px] lg:text-answer">{turn.headline}</p>
          {turn.body.map((t, i) => (
            <p key={i} className="text-body-m text-text-secondary lg:text-body">
              {t}
            </p>
          ))}
          {turn.sourceLabel && (
            <div className="pt-1">
              <EvidenceLine label={turn.sourceLabel} />
            </div>
          )}
        </div>
      )}
      {panels.map((p) => (
        <ProphecyPanel key={p.id} prophecy={p} timeZone={timeZone} />
      ))}
    </div>
  );
}

/** Full transcript (sealed reading, "earlier today"). */
export function Transcript({
  turns,
  prophecies,
  timeZone,
}: {
  turns: Turn[];
  prophecies: Prophecy[];
  timeZone: string;
}) {
  return (
    <div className="flex flex-col gap-9">
      {turns.map((t) => (
        <TurnView key={t.id} turn={t} prophecies={prophecies} timeZone={timeZone} />
      ))}
    </div>
  );
}

export { ReadingSteps };
