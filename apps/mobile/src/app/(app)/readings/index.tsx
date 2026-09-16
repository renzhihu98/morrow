import { formatShortDate, type Prophecy, type Reading } from '@morrow/core';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Hairline, Page, PageState, PageTitle } from '@/components/Page';
import { RecordMarks, StatusMark } from '@/components/Reading';
import { Txt } from '@/components/Txt';
import { useProphecies, useReadings } from '@/data/queries';
import { firstSentence, previousMonthLabel, prophecyStatusLabel, weekdayLabel } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { serifStyle } from '@/theme/typography';

/** Screen 04 — past readings archive. */
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
      <PageTitle eyebrow={`ARCHIVE / ${readings.data?.total ?? '—'} READINGS`} title="Past readings">
        {prophecies.data ? <RecordMarks record={prophecies.data.record} /> : null}
      </PageTitle>
      {!readings.data ? (
        <PageState error={readings.error} onRetry={() => void readings.refetch()} />
      ) : (
        <View>
          {list.map((r) => (
            <ReadingRow key={r.id} reading={r} prophecy={r.prophecyId ? byId.get(r.prophecyId) : undefined} />
          ))}
          <Hairline />
          {oldest ? (
            <Txt variant="label" color="textMuted" style={{ paddingTop: 20 }}>
              {`↓ EARLIER READINGS — ${previousMonthLabel(oldest.localDate)}`}
            </Txt>
          ) : null}
        </View>
      )}
    </Page>
  );
}

function ReadingRow({ reading, prophecy }: { reading: Reading; prophecy?: Prophecy }) {
  const { palette } = useTheme();
  const isToday = reading.status === 'open';
  const date = `${formatShortDate(reading.localDate)} ${weekdayLabel(reading.localDate)}`;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${isToday ? 'Today' : date}. ${reading.headline}`}
      onPress={() => (isToday ? router.navigate('/') : router.push(`/readings/${reading.localDate}`))}
      style={({ pressed }) => [styles.row, { borderTopColor: palette.hairline, opacity: pressed ? 0.6 : 1 }]}
    >
      <View style={styles.meta}>
        <Txt variant="label" color={isToday ? 'accent' : 'textMuted'}>
          {isToday ? `TODAY · ${date}` : date}
        </Txt>
        {isToday ? (
          <Txt variant="label" color="accent">OPEN NOW →</Txt>
        ) : prophecy ? (
          <View style={styles.status}>
            <StatusMark status={prophecy.status} />
            <Txt variant="label" color={prophecy.status === 'fulfilled' ? 'accent' : 'textMuted'}>
              {prophecyStatusLabel(prophecy)}
            </Txt>
          </View>
        ) : (
          <Txt variant="label" color="textFaint">—</Txt>
        )}
      </View>
      <Txt style={serifStyle(21, 26, -0.01)} numberOfLines={2}>
        {firstSentence(reading.headline)}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { borderTopWidth: 1, paddingVertical: 14, gap: 8 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
