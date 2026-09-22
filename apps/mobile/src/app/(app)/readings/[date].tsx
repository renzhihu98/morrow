import { formatShortDate } from '@morrow/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { THREAD_STYLE } from '@/components/chat/MessageRow';
import { Composer } from '@/components/Composer';
import { ChatHeader } from '@/components/Header';
import { Page, PageState } from '@/components/Page';
import { Thread, turnsFromMessages } from '@/components/Transcript';
import { useReading, useToday } from '@/data/queries';

const isLocalDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

/** Screen 10 — a sealed reading (Paper B2K): the day's chat, read-only, with the sealed composer bar. */
export default function SealedReadingScreen() {
  const { date = '' } = useLocalSearchParams<{ date: string }>();
  const detail = useReading(date);
  const today = useToday();

  const now = useMemo(() => new Date(today.data?.now ?? Date.now()), [today.data?.now]);
  const reading = detail.data?.reading;

  // An open reading lives on Today.
  useEffect(() => {
    if (reading?.status === 'open') router.replace('/');
  }, [reading?.status]);

  const header = (
    <ChatHeader
      status={`Reading ${isLocalDate(date) ? formatShortDate(date) : '—'} · sealed`}
      live={false}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/readings'))}
      onMore={() => router.push({ pathname: '/menu', params: { active: 'readings' } })}
    />
  );

  return (
    <Page
      active="readings"
      header={header}
      gutter={0}
      footer={<Composer value="" onChangeText={() => {}} onSend={() => {}} sealed onToday={() => router.navigate('/')} />}
    >
      {detail.data ? (
        <View style={THREAD_STYLE}>
          <Thread
            turns={turnsFromMessages(detail.data.messages, detail.data.prophecies)}
            timeZone={detail.data.reading.timezone}
            now={now}
            date={detail.data.reading.localDate}
            today={today.data?.reading.localDate}
          />
        </View>
      ) : (
        <View style={{ paddingHorizontal: 24 }}>
          <PageState error={detail.error} onRetry={() => void detail.refetch()} />
        </View>
      )}
    </Page>
  );
}
