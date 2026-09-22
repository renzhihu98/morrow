import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { CrystalBall } from '../CrystalBall';
import { Dot } from '../Dot';
import { Txt } from '../Txt';

export type HeroStat = { label: string; value: string; accent?: boolean };

type Props = {
  /** Invocation (03): sentence-case date line, e.g. "Sun · 21 Sept · 07:12". */
  dateLine?: string;
  /** Prophecy fulfilled (07): shows the "Landed" pill beside the ball and the 56pt headline. */
  landed?: boolean;
  title: string;
  body: string;
  /** Foretold / Fulfilled / Record (07). */
  stats?: HeroStat[];
  suggestions: string[];
  onAsk: (q: string) => void;
  disabled?: boolean;
};

/**
 * Today before the first question (Paper B7D invocation, BYB prophecy fulfilled): ball + date line or
 * "Landed" pill, serif headline, greeting, optional stats, three plain hairline suggestion rows.
 * No figure, no sources, no icons or numerals on the rows.
 */
export function TodayHero({ dateLine, landed = false, title, body, stats, suggestions, onAsk, disabled }: Props) {
  const { palette } = useTheme();
  return (
    <View>
      <View style={[styles.top, { paddingTop: landed ? 48 : 112 }]}>
        <CrystalBall size={56} variant="large" state="idle" />
        {landed ? (
          <View style={[styles.pill, { borderColor: palette.hairline }]}>
            <Dot color={palette.highlight} />
            <Txt variant="label" color="textMuted">
              Landed
            </Txt>
          </View>
        ) : dateLine ? (
          <Txt variant="label" color="accent">
            {dateLine}
          </Txt>
        ) : null}
      </View>

      <View style={[styles.copy, { paddingTop: landed ? 28 : 20 }]}>
        <Txt variant={landed ? 'hero' : 'display'} accessibilityRole="header">
          {title}
        </Txt>
        <Txt color="textMuted" style={styles.body}>
          {body}
        </Txt>
        {stats?.length ? (
          <View style={styles.stats}>
            {stats.map((s) => (
              <View key={s.label} style={styles.stat}>
                <Txt variant="label" color="textMuted">
                  {s.label}
                </Txt>
                <Txt variant="meta" color={s.accent ? 'accent' : 'text'} style={styles.statValue}>
                  {s.value}
                </Txt>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={[styles.rows, { borderBottomColor: palette.hairline }]}>
        {suggestions.map((s) => (
          <Pressable
            key={s}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!disabled }}
            disabled={disabled}
            onPress={() => onAsk(s)}
            style={({ pressed }) => [styles.row, { borderTopColor: palette.hairline, opacity: pressed ? 0.6 : 1 }]}
          >
            <Txt>{s}</Txt>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  copy: { paddingHorizontal: 24, gap: 12 },
  body: { fontSize: 15, lineHeight: 23 },
  stats: { flexDirection: 'row', gap: 32, paddingTop: 10 },
  stat: { gap: 4 },
  statValue: { fontSize: 14, lineHeight: 20 },
  rows: { marginHorizontal: 24, marginTop: 36, borderBottomWidth: 1 },
  row: { height: 54, justifyContent: 'center', borderTopWidth: 1 },
});
