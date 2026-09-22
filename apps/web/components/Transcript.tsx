import { formatLocalTime, type Message, type Prophecy } from '@morrow/core';
import type { ReactNode } from 'react';
import { MorrowBubble, MorrowMessage, UserMessage } from './chat/MessageRow';
import { TypingBubble } from './chat/TypingBubble';
import { ProphecyPanel } from './Prophecy';

/**
 * A chat turn normalised for display — from storage (Message) or the live stream (UIMessage).
 * Sources never reach the screen (SPEC §4.A.5): observation provenance and `data-step`s are dropped here.
 */
export type Turn = {
  id: string;
  role: 'user' | 'assistant';
  time: string;
  /** User text, or Morrow's sentences (observation first, then text parts) — one bubble, one paragraph each. */
  paragraphs: string[];
  prophecyRefs: { prophecyId: string; event: 'made' | 'fulfilled' }[];
  /** Morrow hasn't said anything yet: typing bubble. */
  thinking?: boolean;
  /** Live turn still being written. */
  streaming?: boolean;
};

export function turnFromMessage(m: Message, timeZone: string): Turn {
  let observation: string | null = null;
  const texts: string[] = [];
  const prophecyRefs: Turn['prophecyRefs'] = [];
  for (const p of m.parts) {
    if (p.type === 'text') texts.push(p.text);
    else if (p.type === 'observation') observation ??= p.text;
    else if (p.type === 'prophecyRef') prophecyRefs.push({ prophecyId: p.prophecyId, event: p.event });
  }
  return {
    id: m.id,
    role: m.role,
    time: formatLocalTime(m.createdAt, timeZone),
    paragraphs: [observation, ...texts].filter((t): t is string => Boolean(t)),
    prophecyRefs,
  };
}

type TurnViewProps = {
  turn: Turn;
  prophecies: Prophecy[];
  timeZone: string;
  /** Rendered under Morrow's bubbles and cards, inside the same message (e.g. follow-up pills). */
  after?: ReactNode;
};

/** One turn: a Chambray user bubble, or Morrow's avatar + bubble + inline prophecy cards. */
export function TurnView({ turn, prophecies, timeZone, after }: TurnViewProps) {
  if (turn.role === 'user') return <UserMessage>{turn.paragraphs.join(' ')}</UserMessage>;

  const panels = turn.prophecyRefs
    .map((ref) => prophecies.find((p) => p.id === ref.prophecyId))
    .filter((p): p is Prophecy => Boolean(p));
  const speaking = turn.streaming && !turn.thinking;

  return (
    <MorrowMessage time={turn.time} state={turn.thinking ? 'reading' : speaking ? 'speaking' : undefined}>
      {turn.thinking ? (
        <TypingBubble />
      ) : (
        turn.paragraphs.length > 0 && (
          <MorrowBubble>
            <div className="flex flex-col gap-2.5">
              {turn.paragraphs.map((t, i) => (
                <p key={i}>{t}</p>
              ))}
              {speaking && turn.paragraphs.length < 2 && <StillSpeaking />}
            </div>
          </MorrowBubble>
        )
      )}
      {panels.map((p) => (
        <ProphecyPanel key={p.id} prophecy={p} timeZone={timeZone} />
      ))}
      {after}
    </MorrowMessage>
  );
}

/** The pause between Morrow's first sentence and the ones under it, so the wait reads as breath, not a stall. */
function StillSpeaking() {
  return (
    <span className="flex h-4 items-center gap-1.5" role="status" aria-label="Morrow is still speaking">
      <span className="typing-dot size-1.5 rounded-full bg-highlight" />
      <span className="typing-dot size-1.5 rounded-full bg-text-muted opacity-70" />
      <span className="typing-dot size-1.5 rounded-full bg-text-muted opacity-40" />
    </span>
  );
}

/** A run of turns (sealed reading, today's thread). Gap 20 between messages (Paper B8E-0). */
export function Transcript({ turns, prophecies, timeZone }: { turns: Turn[]; prophecies: Prophecy[]; timeZone: string }) {
  return (
    <>
      {turns.map((t) => (
        <TurnView key={t.id} turn={t} prophecies={prophecies} timeZone={timeZone} />
      ))}
    </>
  );
}
