import { formatShortDate } from '@morrow/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Composer } from '@/components/Composer';
import { Page, PageState } from '@/components/Page';
import { Transcript } from '@/components/Transcript';
import { Txt } from '@/components/Txt';
import { useReading, useToday } from '@/data/queries';
import { useTheme } from '@/theme/ThemeProvider';

/** Screen 05 — a sealed reading (read-only transcript). */
export default function SealedReadingScreen() {
  const { date = '' } = useLocalSearchParams<{ date: string }>();
  const detail = useReading(date);
  const today = useToday();
  const { palette } = useTheme();

  const now = useMemo(() => new Date(today.data?.now ?? Date.now()), [today.data?.now]);
  const reading = detail.data?.reading;

  // An open reading lives on Today.
  useEffect(() => {
    if (reading?.status === 'open') router.replace('/');
  }, [reading?.status]);

  const bar = (
    <View style={[styles.bar, { borderBottomColor: palette.hairline }]}>
      <Pressable accessibilityRole="link" hitSlop={10} onPress={() => (router.canGoBack() ? router.back() : router.replace('/readings'))}>
        <Txt variant="label" color="textSecondary">← PAST</Txt>
      </Pressable>
      <Txt variant="label" color="textMuted">{`READING ${/^\d{4}-\d{2}-\d{2}$/.test(date) ? formatShortDate(date) : '—'} · SEALED`}</Txt>
    </View>
  );

  return (
    <Page
      active="readings"
      bar={bar}
      footer={
        <View style={{ paddingTop: 8 }}>
          <Composer value="" onChangeText={() => {}} onSend={() => {}} sealed onToday={() => router.navigate('/')} />
        </View>
      }
    >
      <View style={{ paddingTop: 40 }}>
        {detail.data ? (
          <Transcript
            messages={detail.data.messages}
            prophecies={detail.data.prophecies}
            timeZone={detail.data.reading.timezone}
            now={now}
          />
        ) : (
          <PageState error={detail.error} onRetry={() => void detail.refetch()} />
        )}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
});
