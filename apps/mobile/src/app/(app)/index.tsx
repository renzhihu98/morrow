import { formatShortDate, type Message, type Prophecy, type TodayResponse } from '@morrow/core';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THREAD_STYLE } from '@/components/chat/MessageRow';
import { Composer } from '@/components/Composer';
import { CrystalBall } from '@/components/CrystalBall';
import { ChatHeader, Header } from '@/components/Header';
import { PageState } from '@/components/Page';
import { todayDateLine } from '@/components/today/dates';
import { TodayHero, type HeroStat } from '@/components/today/TodayHero';
import { Thread, turnsFromChat, turnsFromMessages } from '@/components/Transcript';
import { Txt } from '@/components/Txt';
import { useMorrowChat } from '@/data/chat';
import { queryKeys, useProphecies, useToday } from '@/data/queries';
import { useFirstReading } from '@/data/session';
import { shortDateOf } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

const INVOCATION_SUGGESTIONS = ["Draw today's reading", 'What am I not seeing?', "Did last week's prophecy land?"];
const FULFILLED_SUGGESTIONS = ['What comes next?', 'Help me write back', 'Show my track record'];
const RESUME = 'Back to our conversation';

export default function TodayScreen() {
  const today = useToday();
  const first = useFirstReading();
  const { palette } = useTheme();

  if (!today.data) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.bg }}>
        <Header active="today" />
        {today.error ? (
          <View style={{ paddingHorizontal: 24 }}>
            <PageState error={today.error} onRetry={() => void today.refetch()} />
          </View>
        ) : (
          <DrawingReading first={first.state === 'drawing'} />
        )}
      </SafeAreaView>
    );
  }
  return <TodayView key={today.data.reading.id} data={today.data} />;
}

/** First reading (and any cold load): the ball reads while Morrow draws today's reading. */
function DrawingReading({ first }: { first: boolean }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.drawing}>
      <CrystalBall size={64} variant="large" state="reading" />
      <Txt variant="display" accessibilityRole="header" style={{ paddingTop: 20 }}>
        {first ? 'Morrow is reading.' : 'One moment.'}
      </Txt>
      <Txt color="textMuted" style={styles.greeting}>
        {first
          ? 'Reading your week for the first time and drawing today’s reading. This can take a minute.'
          : 'Morrow is gathering today’s reading.'}
      </Txt>
    </View>
  );
}

function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setOpen(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}

function TodayView({ data }: { data: TodayResponse }) {
  const { palette } = useTheme();
  const qc = useQueryClient();
  const prophecies = useProphecies();
  const keyboardOpen = useKeyboardOpen();
  const scrollRef = useRef<ScrollView>(null);
  const [draft, setDraft] = useState('');
  // Back from the chat returns to the invocation; asking (or "Back to our conversation") re-enters it.
  const [showHero, setShowHero] = useState(false);

  const { reading } = data;
  const tz = data.user.timezone;
  const now = useMemo(() => new Date(data.now), [data.now]);
  const chat = useMorrowChat({ readingId: reading.id, baseUsed: reading.questionCount });

  const storedHasUser = data.messages.some((m) => m.role === 'user');
  const conversation = storedHasUser || chat.messages.length > 0;
  const sealed = reading.status === 'sealed' || chat.block === 'sealed';
  const inChat = conversation && !showHero;

  const send = (text: string) => {
    if (text === RESUME) {
      setShowHero(false);
      return;
    }
    if (chat.send(text)) {
      setDraft('');
      setShowHero(false);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  };

  const goToToday = () => {
    chat.reset();
    void qc.invalidateQueries({ queryKey: queryKeys.today });
  };

  const turns = [...turnsFromMessages(data.messages, data.prophecies), ...turnsFromChat(chat.messages, chat.timeOf)];

  const last = chat.messages[chat.messages.length - 1];
  const lastHasText = last?.role === 'assistant' && last.parts.some((p) => (p.type === 'text' && p.text.trim()) || p.type === 'data-observation');
  const thinking = chat.isBusy && !lastHasText;
  const speakingId = chat.isBusy && lastHasText ? last?.id : undefined;

  const composer = (
    <Composer
      dock={inChat ? 'chat' : 'page'}
      value={draft}
      onChangeText={setDraft}
      onSend={() => send(draft)}
      onStop={() => void chat.stop()}
      onToday={goToToday}
      waiting={chat.isBusy}
      sealed={sealed}
      limitReached={chat.block === 'limit'}
      used={chat.used}
      limit={chat.limit}
      showCounter={inChat && (chat.used > 0 || draft.length > 0)}
      keyboardOpen={keyboardOpen}
    />
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: palette.bg }]}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {inChat ? (
          <>
            <ChatHeader
              onBack={() => setShowHero(true)}
              onMore={() => router.push({ pathname: '/menu', params: { active: 'today' } })}
              ballState={thinking ? 'reading' : speakingId ? 'speaking' : undefined}
            />
            <ScrollView
              ref={scrollRef}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={THREAD_STYLE}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >
              <Thread
                turns={turns}
                timeZone={tz}
                now={now}
                date={reading.localDate}
                today={reading.localDate}
                live={!sealed}
                thinking={thinking}
                speakingId={speakingId}
              />
              {chat.errorMessage ? (
                <Txt variant="label" color="danger" style={{ marginTop: 6 }}>
                  {chat.errorMessage}
                </Txt>
              ) : null}
            </ScrollView>
          </>
        ) : (
          <>
            <Header active="today" />
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.heroScroll}>
              <Hero
                data={data}
                record={prophecies.data?.record}
                onAsk={send}
                disabled={sealed || chat.isBusy}
                resumable={conversation}
              />
            </ScrollView>
          </>
        )}
        {composer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Screens 03 (invocation, Paper B7D) and 07 (prophecy fulfilled, Paper BYB) — before the first question. */
function Hero({
  data,
  record,
  onAsk,
  disabled,
  resumable,
}: {
  data: TodayResponse;
  record?: { fulfilled: number; marks: unknown[] };
  onAsk: (q: string) => void;
  disabled: boolean;
  resumable: boolean;
}) {
  const tz = data.user.timezone;
  const opening: Message | undefined = data.messages.find((m) => m.role === 'assistant');
  const parts = opening?.parts ?? [];
  const byId = new Map(data.prophecies.map((p) => [p.id, p]));
  const fulfilledRef = parts.find((p) => p.type === 'prophecyRef' && p.event === 'fulfilled');
  const fulfilled: Prophecy | undefined =
    fulfilledRef?.type === 'prophecyRef' ? byId.get(fulfilledRef.prophecyId) : undefined;
  const observation = parts.find((p) => p.type === 'observation');
  const texts = parts.flatMap((p) => (p.type === 'text' ? [p.text] : []));

  const title = observation?.type === 'observation' ? observation.text : (texts[0] ?? data.reading.headline);
  const body =
    (observation ? texts[0] : texts[1]) ??
    `Good morning, ${data.user.name}. I read your week while you slept. There is one pattern worth your attention.`;

  const stats: HeroStat[] | undefined = fulfilled
    ? [
        { label: 'Foretold', value: formatShortDate(fulfilled.madeOn) },
        { label: 'Fulfilled', value: fulfilled.resolvedAt ? shortDateOf(fulfilled.resolvedAt, tz) : '—', accent: true },
        { label: 'Record', value: record ? `${record.fulfilled} / ${record.marks.length}` : '—' },
      ]
    : undefined;

  const suggestions = fulfilled ? FULFILLED_SUGGESTIONS : INVOCATION_SUGGESTIONS;

  return (
    <TodayHero
      dateLine={fulfilled ? undefined : todayDateLine(data.now, tz)}
      landed={!!fulfilled}
      title={title}
      body={body}
      stats={stats}
      suggestions={resumable ? [RESUME, ...suggestions] : suggestions}
      onAsk={(q) => (q === RESUME || !disabled) && onAsk(q)}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  drawing: { paddingHorizontal: 24, paddingTop: 96 },
  greeting: { paddingTop: 12, fontSize: 15, lineHeight: 23 },
  heroScroll: { flexGrow: 1, paddingBottom: 28 },
});
