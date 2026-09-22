import { formatLocalTime, type Message, type Prophecy } from '@morrow/core';
import { StyleSheet, View } from 'react-native';
import { shortDateOf, windowLabel } from '@/lib/format';
import { assistantView, userText, type MorrowUIMessage } from '@/lib/chat-protocol';
import { DayDivider } from './chat/DayDivider';
import { MessageRow } from './chat/MessageRow';
import { TypingBubble } from './chat/TypingBubble';
import type { CrystalBallState } from './CrystalBall';
import { ProphecyCard } from './ProphecyCard';
import { chatDayLabel } from './today/dates';

/**
 * v4 chat thread (SPEC §4.F, Paper BQQ/BH0/C7K/B2K). Stored messages and live `useChat` turns are
 * normalised into one list of turns and rendered as bubbles: user right (Chambray), Morrow left with
 * the ball avatar on the last bubble of each group, prophecy parts as inline cards in the bubble column.
 * Reading steps (`steps` / `data-step`) and source labels are never rendered (SPEC §4.A.5).
 */

type Segment = { kind: 'text'; text: string } | { kind: 'prophecy'; prophecy: Prophecy; event: 'made' | 'fulfilled' };

export type Turn = {
  id: string;
  role: 'user' | 'morrow';
  at: Date;
  segments: Segment[];
};

/** A time divider is drawn before a user turn that comes this long after the previous turn. */
const GAP_MS = 5 * 60_000;

/** Stored (server) messages → turns. Prophecy refs resolve against `prophecies`; unknown ids are dropped. */
export function turnsFromMessages(messages: Message[], prophecies: Prophecy[]): Turn[] {
  const byId = new Map(prophecies.map((p) => [p.id, p]));
  return messages.map((m) => {
    const segments: Segment[] = [];
    for (const part of m.parts) {
      if (part.type === 'text' || part.type === 'observation') {
        if (part.text.trim()) segments.push({ kind: 'text', text: part.text });
      } else if (part.type === 'prophecyRef') {
        const p = byId.get(part.prophecyId);
        if (p) segments.push({ kind: 'prophecy', prophecy: p, event: part.event });
      }
    }
    return { id: m.id, role: m.role === 'user' ? 'user' : 'morrow', at: new Date(m.createdAt), segments };
  });
}

/** Live `useChat` messages → turns (observation first, then text parts; steps ignored). */
export function turnsFromChat(messages: MorrowUIMessage[], timeOf: (id: string) => Date): Turn[] {
  return messages.map((m) => {
    if (m.role === 'user') {
      return { id: m.id, role: 'user', at: timeOf(m.id), segments: [{ kind: 'text', text: userText(m) }] };
    }
    const view = assistantView(m);
    const texts = view.observation ? [view.observation.text, ...view.texts.filter((t) => t !== view.observation?.text)] : view.texts;
    return { id: m.id, role: 'morrow', at: timeOf(m.id), segments: texts.map((text) => ({ kind: 'text', text })) };
  });
}

type Props = {
  turns: Turn[];
  timeZone: string;
  now: Date;
  /** Local date of the thread (`YYYY-MM-DD`); the first divider reads "Today · 06:43" when it is today. */
  date: string;
  today?: string;
  /** Live Today thread: open prophecies carry "I'll tell you when it lands." Sealed threads don't. */
  live?: boolean;
  /** Show Morrow's thinking bubble at the end (Asking). */
  thinking?: boolean;
  /** Avatar state for the last Morrow turn while it streams. */
  speakingId?: string;
};

export function Thread({ turns, timeZone, now, date, today, live = false, thinking = false, speakingId }: Props) {
  const visible = turns.filter((t) => t.segments.length > 0);
  const first = visible[0];

  return (
    <View style={styles.list}>
      {first ? <DayDivider label={chatDayLabel(date, formatLocalTime(first.at, timeZone), today)} /> : null}
      {visible.map((turn, i) => {
        const prev = visible[i - 1];
        const divider =
          prev && turn.role === 'user' && turn.at.getTime() - prev.at.getTime() >= GAP_MS ? (
            <DayDivider label={formatLocalTime(turn.at, timeZone)} inset />
          ) : null;
        return (
          <View key={turn.id} style={styles.list}>
            {divider}
            {turn.role === 'user' ? (
              <MessageRow from="user">{turn.segments.map((s) => (s.kind === 'text' ? s.text : '')).join('\n')}</MessageRow>
            ) : (
              <MorrowTurn
                turn={turn}
                timeZone={timeZone}
                now={now}
                live={live}
                ballState={turn.id === speakingId ? 'speaking' : undefined}
              />
            )}
          </View>
        );
      })}
      {thinking ? <TypingBubble /> : null}
    </View>
  );
}

function MorrowTurn({
  turn,
  timeZone,
  now,
  live,
  ballState,
}: {
  turn: Turn;
  timeZone: string;
  now: Date;
  live: boolean;
  ballState?: CrystalBallState;
}) {
  const { segments } = turn;
  // The avatar sits on the last text bubble; a turn with only cards puts it on the last card.
  let avatarAt = -1;
  segments.forEach((s, i) => {
    if (s.kind === 'text') avatarAt = i;
  });
  if (avatarAt === -1) avatarAt = segments.length - 1;

  return (
    <>
      {segments.map((s, i) => {
        const last = i === avatarAt;
        if (s.kind === 'text') {
          return (
            <MessageRow key={i} from="morrow" last={last} ballState={last ? ballState : undefined}>
              {s.text}
            </MessageRow>
          );
        }
        const p = s.prophecy;
        const landed = s.event === 'fulfilled' && p.status === 'fulfilled' && !!p.resolvedAt;
        return (
          <MessageRow key={i} from="morrow" bare last={last}>
            <ProphecyCard
              statement={p.statement}
              likelihood={p.likelihood}
              window={landed ? undefined : windowLabel(p, now, timeZone).text}
              landedAt={landed && p.resolvedAt ? shortDateOf(p.resolvedAt, timeZone) : undefined}
              footer={live && p.status === 'open' ? 'I’ll tell you when it lands.' : undefined}
            />
          </MessageRow>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  list: { gap: 14 },
});
