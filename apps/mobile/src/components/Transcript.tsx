import { formatLocalTime, type Message, type Prophecy } from '@morrow/core';
import { StyleSheet, View } from 'react-native';
import { sansStyle } from '@/theme/typography';
import { EvidenceLine, ProphecyPanel, ReadingSteps, stepsFromCore, TurnLabel } from './Reading';
import { Txt } from './Txt';

type Props = {
  messages: Message[];
  prophecies: Prophecy[];
  timeZone: string;
  now: Date;
  /** Render all but the last `keepBright` messages at 35% (screen 06). */
  dimBefore?: number;
};

/** Stored (server) messages: user turns, Morrow observations/answers, prophecy panels, steps. */
export function Transcript({ messages, prophecies, timeZone, now, dimBefore }: Props) {
  const byId = new Map(prophecies.map((p) => [p.id, p]));
  return (
    <View style={styles.list}>
      {messages.map((m, idx) => {
        const time = formatLocalTime(m.createdAt, timeZone);
        const dim = dimBefore !== undefined && idx < dimBefore;
        if (m.role === 'user') {
          const text = m.parts.map((p) => (p.type === 'text' ? p.text : '')).join('');
          return (
            <View key={m.id} style={[styles.user, dim && styles.dim]}>
              <TurnLabel who="you" time={time} />
              <Txt variant="bodyLg" style={sansStyle(15, 22)}>
                {text}
              </Txt>
            </View>
          );
        }
        let serifUsed = false;
        return (
          <View key={m.id} style={[styles.morrow, dim && styles.dim]}>
            <TurnLabel who="morrow" time={time} />
            {m.parts.map((part, i) => {
              switch (part.type) {
                case 'observation':
                  serifUsed = true;
                  return (
                    <View key={i} style={{ gap: 10 }}>
                      <Txt variant="answer">{part.text}</Txt>
                      <EvidenceLine label={part.sourceLabel} />
                    </View>
                  );
                case 'text': {
                  const asSerif = !serifUsed;
                  serifUsed = true;
                  return asSerif ? (
                    <Txt key={i} variant="answer">
                      {part.text}
                    </Txt>
                  ) : (
                    <Txt key={i} color="textSecondary">
                      {part.text}
                    </Txt>
                  );
                }
                case 'prophecyRef': {
                  const p = byId.get(part.prophecyId);
                  if (!p) return null;
                  return (
                    <View key={i} style={{ marginTop: 16 }}>
                      <ProphecyPanel prophecy={p} now={now} timeZone={timeZone} />
                    </View>
                  );
                }
                case 'steps':
                  return <ReadingSteps key={i} steps={stepsFromCore(part.items)} heading={false} />;
                default:
                  return null;
              }
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 26 },
  user: { gap: 6 },
  morrow: { gap: 10 },
  dim: { opacity: 0.35 },
});
