import { formatLocalTime, formatShortDate, type Message, type Prophecy, type TodayResponse } from '@morrow/core';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Composer } from '@/components/Composer';
import { Header } from '@/components/Header';
import { MiniOrbit, Orbit } from '@/components/Orbit';
import { PageState } from '@/components/Page';
import { IndexList, ProphecyPanel, ReadingSteps, TurnLabel } from '@/components/Reading';
import { Transcript } from '@/components/Transcript';
import { Txt } from '@/components/Txt';
import { useMorrowChat } from '@/data/chat';
import { queryKeys, useProphecies, useSources, useToday } from '@/data/queries';
import { useFirstReading } from '@/data/session';
import { assistantView, userText, type MorrowUIMessage } from '@/lib/chat-protocol';
import { shortDateOf } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { monoStyle, sansStyle, serifStyle } from '@/theme/typography';

const INVOCATION_SUGGESTIONS = ["Draw today's reading", 'What am I not seeing?', "Did last week's prophecy land?"];
const FULFILLED_SUGGESTIONS = ['What comes next?', 'Help me write back', 'Show my track record'];

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

/** Step 3 "First reading" (and any cold load): the orbit turns while Morrow draws today's reading. */
function DrawingReading({ first }: { first: boolean }) {
  return (
    <View accessibilityLiveRegion="polite">
      <View style={[styles.orbitWrap, { paddingTop: 12 }]}>
        <Orbit state="reading" size={236} />
      </View>
      <View style={styles.gutter}>
        <Txt variant="display" accessibilityRole="header" style={{ paddingTop: 20 }}>
          {first ? 'Morrow is reading.' : 'One moment.'}
        </Txt>
        <Txt color="textSecondary" style={{ paddingTop: 14 }}>
          {first
            ? 'Reading your sources for the first time and drawing today’s reading. This can take a minute.'
            : 'Morrow is gathering today’s reading.'}
        </Txt>
      </View>
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
  const sources = useSources();
  const prophecies = useProphecies();
  const keyboardOpen = useKeyboardOpen();
  const scrollRef = useRef<ScrollView>(null);
  const [draft, setDraft] = useState('');

  const { reading, user } = data;
  const tz = user.timezone;
  const now = useMemo(() => new Date(data.now), [data.now]);
  const chat = useMorrowChat({ readingId: reading.id, baseUsed: reading.questionCount });

  const storedHasUser = data.messages.some((m) => m.role === 'user');
  const conversation = storedHasUser || chat.messages.length > 0;
  const sealed = reading.status === 'sealed' || chat.block === 'sealed';

  const linkedCount = sources.data?.sources.filter((s) => s.status === 'linked').length ?? 0;
  const eventCount = sources.data?.sources.reduce((n, s) => n + (s.stat?.label === 'events' ? s.stat.value : 0), 0) ?? 0;

  const send = (text: string) => {
    if (chat.send(text)) {
      setDraft('');
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  };

  const goToToday = () => {
    chat.reset();
    void qc.invalidateQueries({ queryKey: queryKeys.today });
  };

  const composer = (
    <Composer
      value={draft}
      onChangeText={setDraft}
      onSend={() => send(draft)}
      onStop={() => void chat.stop()}
      onToday={goToToday}
      todayLabel="Today's reading"
      waiting={chat.isBusy}
      sealed={sealed}
      limitReached={chat.block === 'limit'}
      used={chat.used}
      limit={chat.limit}
      showCounter={chat.used > 0 || draft.length > 0}
      keyboardOpen={keyboardOpen}
    />
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: palette.bg }]}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Header active="today" />
        {conversation ? (
          <>
            <View style={[styles.subbar, { borderBottomColor: palette.hairline }]}>
              <MiniOrbit active={chat.isBusy} />
              {chat.isBusy ? (
                <Txt variant="label" color="accent">{`Consulting ${linkedCount} sources`}</Txt>
              ) : (
                <Txt variant="label" color="textMuted">{`Reading ${eventCount} events · ${linkedCount} sources`}</Txt>
              )}
            </View>
            <ScrollView
              ref={scrollRef}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.conversation}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >
              <Transcript
                messages={data.messages}
                prophecies={data.prophecies}
                timeZone={tz}
                now={now}
                dimBefore={chat.messages.length > 0 ? data.messages.length : undefined}
              />
              <ChatTurns chat={chat} timeZone={tz} />
              {chat.errorMessage ? (
                <Txt variant="label" color="danger" style={{ marginTop: 20 }}>
                  {chat.errorMessage}
                </Txt>
              ) : null}
            </ScrollView>
          </>
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 28 }}>
            <Hero data={data} now={now} record={prophecies.data?.record} onAsk={send} disabled={sealed || chat.isBusy} />
          </ScrollView>
        )}
        {composer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Screens 01 (invocation) and 03 (prophecy fulfilled) — before the first question. */
function Hero({
  data,
  now,
  record,
  onAsk,
  disabled,
}: {
  data: TodayResponse;
  now: Date;
  record?: { fulfilled: number; marks: unknown[] };
  onAsk: (q: string) => void;
  disabled: boolean;
}) {
  const tz = data.user.timezone;
  const opening: Message | undefined = data.messages.find((m) => m.role === 'assistant');
  const parts = opening?.parts ?? [];
  const byId = new Map(data.prophecies.map((p) => [p.id, p]));
  const fulfilledRef = parts.find((p) => p.type === 'prophecyRef' && p.event === 'fulfilled');
  const fulfilled: Prophecy | undefined =
    fulfilledRef?.type === 'prophecyRef' ? byId.get(fulfilledRef.prophecyId) : undefined;
  const made = parts.flatMap((p) => (p.type === 'prophecyRef' && p.event === 'made' ? [byId.get(p.prophecyId)] : [])).filter(
    (p): p is Prophecy => !!p,
  );
  const observation = parts.find((p) => p.type === 'observation');
  const texts = parts.flatMap((p) => (p.type === 'text' ? [p.text] : []));

  const title = observation?.type === 'observation' ? observation.text : (texts[0] ?? data.reading.headline);
  const body =
    (observation ? texts[0] : texts[1]) ??
    `Good morning, ${data.user.name}. I read your week while you slept. There is one pattern worth your attention.`;

  const suggestions = fulfilled ? FULFILLED_SUGGESTIONS : INVOCATION_SUGGESTIONS;

  return (
    <View>
      <View style={[styles.orbitWrap, { paddingTop: 12 }]}>
        <Orbit state={fulfilled ? 'fulfilled' : 'idle'} size={fulfilled ? 200 : 236} />
      </View>
      <View style={styles.gutter}>
        <Txt
          variant="display"
          accessibilityRole="header"
          style={[{ paddingTop: 20 }, fulfilled ? serifStyle(56, 56, -0.015) : null]}
        >
          {title}
        </Txt>
        <Txt color="textSecondary" style={{ paddingTop: 14 }}>
          {body}
        </Txt>
        {fulfilled ? (
          <View style={styles.stats}>
            <Stat label="Foretold" value={formatShortDate(fulfilled.madeOn)} />
            <Stat label="Fulfilled" value={fulfilled.resolvedAt ? shortDateOf(fulfilled.resolvedAt, tz) : '—'} accent />
            <Stat label="Record" value={record ? `${record.fulfilled} / ${record.marks.length}` : '—'} />
          </View>
        ) : null}
      </View>
      <View style={[styles.gutter, { paddingTop: 22 }]}>
        <IndexList items={suggestions} renderLabel={(s) => s} onPress={(s) => !disabled && onAsk(s)} />
      </View>
      {made.map((p) => (
        <View key={p.id} style={[styles.gutter, { paddingTop: 28 }]}>
          <ProphecyPanel prophecy={p} now={now} timeZone={tz} />
        </View>
      ))}
    </View>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={{ gap: 5 }}>
      <Txt variant="label" color="textMuted" style={{ fontSize: 10, lineHeight: 12 }}>
        {label}
      </Txt>
      <Txt color={accent ? 'accent' : 'textPrimary'} style={monoStyle(14, 18, 0)}>
        {value}
      </Txt>
    </View>
  );
}

/** Live turns from `useChat` (screens 06 asking → 07 answer). */
function ChatTurns({ chat, timeZone }: { chat: ReturnType<typeof useMorrowChat>; timeZone: string }) {
  const msgs = chat.messages;
  if (msgs.length === 0) return null;
  const lastUserIdx = msgs.map((m) => m.role).lastIndexOf('user');
  const last = msgs[msgs.length - 1];
  const awaitingFirstChunk = chat.isBusy && last?.role === 'user';

  return (
    <View style={{ gap: 26, marginTop: 26 }}>
      {msgs.map((m, i) => (
        <ChatTurn
          key={m.id}
          message={m}
          time={formatLocalTime(chat.timeOf(m.id), timeZone)}
          dim={i < lastUserIdx}
          streaming={chat.isBusy && i === msgs.length - 1}
        />
      ))}
      {awaitingFirstChunk ? <ReadingSteps steps={[]} /> : null}
    </View>
  );
}

function ChatTurn({ message, time, dim, streaming }: { message: MorrowUIMessage; time: string; dim: boolean; streaming: boolean }) {
  if (message.role === 'user') {
    return (
      <View style={[{ gap: 6 }, dim && styles.dim]}>
        <TurnLabel who="you" time={time} />
        <Txt variant="bodyLg">{userText(message)}</Txt>
      </View>
    );
  }
  const view = assistantView(message);
  const serif = view.observation?.text ?? view.texts[0];
  const rest = view.texts.filter((t) => t !== serif);
  const hasAnswer = !!serif;
  const steps = view.steps.map((s) => ({ key: s.id, label: s.label, detail: s.detail, status: s.status }));

  if (!hasAnswer) {
    if (steps.length === 0 && !streaming) return null;
    return (
      <View style={dim && styles.dim}>
        <ReadingSteps steps={steps} heading={streaming} />
      </View>
    );
  }
  return (
    <View style={[{ gap: 10 }, dim && styles.dim]}>
      <TurnLabel who="morrow" time={time} />
      <Txt variant="answer">{serif}</Txt>
      {rest.map((t, i) => (
        <Txt key={i} color="textSecondary" style={sansStyle(15, 23)}>
          {t}
        </Txt>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  gutter: { paddingHorizontal: 24 },
  orbitWrap: { alignItems: 'center' },
  stats: { flexDirection: 'row', gap: 36, paddingTop: 20 },
  subbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 24, borderBottomWidth: 1 },
  conversation: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: 24, paddingTop: 48, paddingBottom: 28 },
  dim: { opacity: 0.35 },
});
