import { formatShortDate, type Prophecy, type Reading } from '@morrow/core';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Dot } from '@/components/Dot';
import { Hairline, Page, PageState } from '@/components/Page';
import { RecordCounts } from '@/components/RecordMarks';
import { Txt } from '@/components/Txt';
import { useProphecies, useReadings } from '@/data/queries';
import { firstSentence, previousMonthLabel, weekdayLabel } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { ink } from '@/theme/ink';
import { serifStyle } from '@/theme/typography';

/** v4 screen 09 — past readings archive (Paper CDI). */
export default function ReadingsScreen() {
  const readings = useReadings();
  const prophecies = useProphecies();

  const all: Prophecy[] = prophecies.data ? [...prophecies.data.open, ...prophecies.data.resolved] : [];
  const byId = new Map(all.map((p) => [p.id, p]));
  const list = readings.data?.readings ?? [];
  const oldest = list[list.length - 1];

  return (
    <Page
      active="readings"
      refreshing={readings.isRefetching}
      onRefresh={() => {
        void readings.refetch();
        void prophecies.refetch();
      }}
    >
      <View style={styles.titleBlock}>
        <Txt variant="label" color="textMuted">
          The archive
        </Txt>
        <Txt variant="title" accessibilityRole="header">
          Past readings
        </Txt>
        {prophecies.data ? (
          <View style={{ paddingTop: 4 }}>
            <RecordCounts record={prophecies.data.record} />
          </View>
        ) : null}
      </View>
      {!readings.data ? (
        <PageState error={readings.error} onRetry={() => void readings.refetch()} />
      ) : (
        <View>
          {list.map((r) => (
            <ReadingRow key={r.id} reading={r} prophecy={r.prophecyId ? byId.get(r.prophecyId) : undefined} />
          ))}
          <Hairline />
          {oldest ? (
            <View style={styles.earlier}>
              <Txt variant="label" color="accent">
                ↓
              </Txt>
              <Txt variant="label" color="textMuted">
                {`Earlier readings — ${previousMonthLabel(oldest.localDate)}`}
              </Txt>
            </View>
          ) : null}
        </View>
      )}
    </Page>
  );
}

type Status = 'today' | Prophecy['status'] | 'none';

/** Right-hand status pill (Paper CDI): sentence-case Geist, no numerals. */
function StatusPill({ status }: { status: Status }) {
  const { palette } = useTheme();
  switch (status) {
    case 'today':
      return (
        <View style={[styles.pill, styles.pillFilled, { backgroundColor: palette.accent }]}>
          <Txt variant="label" color="onAccent">
            Open now →
          </Txt>
        </View>
      );
    case 'open':
      return (
        <View style={[styles.pill, { borderColor: palette.accent }]}>
          <Txt variant="label" color="accent">
            Open
          </Txt>
        </View>
      );
    case 'fulfilled':
      return (
        <View style={[styles.pill, { borderColor: palette.hairline }]}>
          <Dot color={palette.highlight} />
          <Txt variant="label" color="textMuted">
            Fulfilled
          </Txt>
        </View>
      );
    case 'expired':
      return (
        <View style={[styles.pill, { borderColor: ink.dashed, borderStyle: 'dashed' }]}>
          <Txt variant="label" color="textMuted">
            Expired
          </Txt>
        </View>
      );
    default:
      return (
        <Txt variant="label" color="textMuted" accessibilityLabel="No prophecy">
          —
        </Txt>
      );
  }
}

const STATUS_A11Y: Record<Status, string> = {
  today: 'Open now',
  open: 'Prophecy open',
  fulfilled: 'Prophecy fulfilled',
  expired: 'Prophecy expired',
  none: 'No prophecy',
};

function ReadingRow({ reading, prophecy }: { reading: Reading; prophecy?: Prophecy }) {
  const { palette } = useTheme();
  const isToday = reading.status === 'open';
  const short = formatShortDate(reading.localDate);
  const weekday = weekdayLabel(reading.localDate);
  const status: Status = isToday ? 'today' : prophecy ? prophecy.status : 'none';
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${isToday ? 'Today, ' : ''}${short} ${weekday}. ${reading.headline}. ${STATUS_A11Y[status]}.`}
      onPress={() => (isToday ? router.navigate('/') : router.push(`/readings/${reading.localDate}`))}
      style={({ pressed }) => [styles.row, { borderTopColor: palette.hairline, opacity: pressed ? 0.6 : 1 }]}
    >
      <View style={styles.meta}>
        <Txt variant="label" color={isToday ? 'accent' : 'textMuted'}>
          {isToday ? 'Today · ' : ''}
          <Txt variant="meta" color={isToday ? 'accent' : 'textMuted'}>
            {short}
          </Txt>
          {` ${weekday}`}
        </Txt>
        <StatusPill status={status} />
      </View>
      <Txt color={status === 'expired' ? 'textMuted' : 'text'} style={serifStyle(22, 28, -0.01)} numberOfLines={2}>
        {firstSentence(reading.headline)}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  titleBlock: { paddingTop: 40, paddingBottom: 28, gap: 10 },
  row: { borderTopWidth: 1, paddingTop: 14, paddingBottom: 16, gap: 6 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 22 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 2,
    paddingHorizontal: 9,
  },
  pillFilled: { borderWidth: 0, paddingVertical: 3, paddingHorizontal: 10 },
  earlier: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 20 },
});
