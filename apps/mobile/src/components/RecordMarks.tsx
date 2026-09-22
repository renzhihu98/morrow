import type { ProphecyRecord, ProphecyStatus } from '@morrow/core';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import type { Palette } from '@morrow/tokens';
import { Dot } from './Dot';
import { Txt } from './Txt';

/** One count: mono numeral + Geist word, e.g. `7 fulfilled` (SPEC §4.D: mono is for numerals only). */
function Count({ n, word, color }: { n: number; word: string; color: keyof Palette }) {
  return (
    <Txt variant="label" color={color}>
      <Txt variant="meta" color={color}>
        {String(n)}
      </Txt>
      {` ${word}`}
    </Txt>
  );
}

/** `7 fulfilled  3 open  2 expired` (Paper CDI/AZD): Black Fig, Oxblood, Capers. */
export function RecordCounts({ record }: { record: Pick<ProphecyRecord, 'fulfilled' | 'open' | 'expired'> }) {
  return (
    <View
      style={styles.counts}
      accessible
      accessibilityLabel={`${record.fulfilled} fulfilled, ${record.open} open, ${record.expired} expired`}
    >
      <Count n={record.fulfilled} word="fulfilled" color="text" />
      <Count n={record.open} word="open" color="accent" />
      <Count n={record.expired} word="expired" color="textMuted" />
    </View>
  );
}

const MARK = 8;

/** A single record mark: filled Oxblood dot (fulfilled), dash (expired), hollow ring (open). */
export function RecordMark({ status }: { status: ProphecyStatus }) {
  const { palette } = useTheme();
  if (status === 'fulfilled') return <Dot color={palette.accent} size={MARK} />;
  if (status === 'open') return <Dot color={palette.accent} size={MARK} hollow />;
  return (
    <View style={styles.dashBox}>
      <View style={[styles.dash, { backgroundColor: palette.textMuted }]} />
    </View>
  );
}

/** Record strip (SPEC §4.F): the last 12 prophecies, oldest → newest. It is data, not decoration. */
export function RecordStrip({ marks }: { marks: ProphecyStatus[] }) {
  if (marks.length === 0) return null;
  const f = marks.filter((m) => m === 'fulfilled').length;
  const e = marks.filter((m) => m === 'expired').length;
  const o = marks.length - f - e;
  return (
    <View
      style={styles.strip}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Last ${marks.length} prophecies: ${f} fulfilled, ${e} expired, ${o} open`}
    >
      {marks.slice(-12).map((m, i) => (
        <RecordMark key={i} status={m} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  counts: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  strip: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dashBox: { width: MARK, height: MARK, justifyContent: 'center' },
  dash: { height: 1.5, borderRadius: 1 },
});
