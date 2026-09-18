'use client';

import { useChat } from '@ai-sdk/react';
import { formatLocalTime, formatShortDate, getLocalParts, type Prophecy, type TodayResponse } from '@morrow/core';
import { DefaultChatTransport, generateId } from 'ai';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import type { MorrowUIMessage, StepData } from '@/lib/chat-types';
import { shortDateOf } from '@/lib/ui/format';
import { Composer } from './Composer';
import { IndexList } from './IndexList';
import { Stat } from './Labels';
import { Orbit, type OrbitNode } from './Orbit';
import { ReadingSteps } from './ReadingSteps';
import { Transcript, TurnView, turnFromMessage, type Turn } from './Transcript';

type Props = {
  initial: TodayResponse;
  /** `Calendar · Spotify · Mail` */
  linkedSources: string;
  /** e.g. `Reading 214 events across 3 sources` */
  readingCaption: string;
  linkedCount: number;
  record: { fulfilled: number; total: number };
};

type ChatErrorCode = 'reading_sealed' | 'question_limit' | 'other';

function errorCode(error: Error | undefined): ChatErrorCode | null {
  if (!error) return null;
  try {
    const code = (JSON.parse(error.message) as { error?: { code?: string } }).error?.code;
    if (code === 'reading_sealed' || code === 'question_limit') return code;
  } catch {
    /* not a JSON error body */
  }
  return 'other';
}

function contactLabel(evidenceRef: string | undefined): string {
  const parts = (evidenceRef ?? '').split('.');
  const i = parts.indexOf('people');
  const key = i >= 0 ? parts[i + 1] : parts.at(-1);
  return (key ?? 'you')
    .replace(/_/g, ' ')
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

const greeting = (hour: number) => (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');

export function Today({ initial, linkedSources, readingCaption, linkedCount, record }: Props) {
  const router = useRouter();
  const { user, reading } = initial;
  const tz = user.timezone;

  // Server clock (demo mode runs on fixture time) → keep a stable offset for new turn timestamps.
  const clockOffset = useRef(Date.parse(initial.now) - Date.now());
  const stamps = useRef(new Map<string, string>());
  const stamp = (id: string) => {
    if (!stamps.current.has(id)) stamps.current.set(id, formatLocalTime(new Date(Date.now() + clockOffset.current), tz));
    return stamps.current.get(id)!;
  };

  const [input, setInput] = useState('');
  const [used, setUsed] = useState(reading.questionCount);
  const [revealed, setRevealed] = useState(false);
  const [showEarlier, setShowEarlier] = useState(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<MorrowUIMessage>({
        api: '/api/chat',
        prepareSendMessagesRequest: ({ messages }) => ({
          body: { message: messages.at(-1), readingId: reading.id },
        }),
      }),
    [reading.id],
  );

  const chat = useChat<MorrowUIMessage>({
    id: reading.id,
    transport,
    generateId: () => `m_${generateId()}`,
    onData: (part) => {
      if (part.type === 'data-quota') setUsed(part.data.used);
    },
    onFinish: () => router.refresh(),
  });

  const errorKind = errorCode(chat.error);
  const busy = chat.status === 'submitted' || chat.status === 'streaming';
  const limitReached = errorKind === 'question_limit' || used >= initial.questionLimit;

  const stored = useMemo(() => initial.messages.map((m) => turnFromMessage(m, tz)), [initial.messages, tz]);
  const storedIds = new Set(stored.map((t) => t.id));

  const live: Turn[] = chat.messages
    .filter((m) => !storedIds.has(m.id))
    .map((m) => {
      const texts = m.parts.flatMap((p) => (p.type === 'text' ? [p.text] : []));
      const observation = m.parts.find((p) => p.type === 'data-observation')?.data;
      const steps = m.parts.flatMap((p): StepData[] => (p.type === 'data-step' ? [p.data] : []));
      return {
        id: m.id,
        role: m.role === 'user' ? 'user' : 'assistant',
        time: stamp(m.id),
        headline: m.role === 'user' ? texts.join('') : (observation?.text ?? ''),
        body: m.role === 'user' ? [] : texts.filter(Boolean),
        sourceLabel: observation?.sourceLabel ?? null,
        prophecyRefs: [],
        steps,
        streaming: busy,
      } satisfies Turn;
    });

  const turns = [...stored, ...live];
  const opening = stored[0];
  const openingMessage = initial.messages[0];
  const fulfilledRef = openingMessage?.parts.find((p) => p.type === 'prophecyRef' && p.event === 'fulfilled');
  const fulfilled: Prophecy | undefined =
    fulfilledRef?.type === 'prophecyRef' ? initial.prophecies.find((p) => p.id === fulfilledRef.prophecyId) : undefined;
  const openingObservation = openingMessage?.parts.find((p) => p.type === 'observation');
  const madeRef = openingMessage?.parts.find((p) => p.type === 'prophecyRef' && p.event === 'made');
  const made = madeRef?.type === 'prophecyRef' ? initial.prophecies.find((p) => p.id === madeRef.prophecyId) : undefined;

  const lastUserIndex = turns.findLastIndex((t) => t.role === 'user');
  const hasQuestions = lastUserIndex >= 0;

  const send = (text: string) => {
    if (busy || limitReached) return;
    setRevealed(true);
    setInput('');
    chat.clearError();
    void chat.sendMessage({ text });
  };

  // ── view selection ────────────────────────────────────────────────────────
  type View = 'invocation' | 'fulfilled' | 'reading' | 'asking' | 'answer';
  const lastTurn = turns.at(-1);
  const awaitingAnswer = hasQuestions && (lastTurn?.role === 'user' || (busy && !lastTurn?.headline));
  const view: View = awaitingAnswer
    ? 'asking'
    : hasQuestions
      ? 'answer'
      : revealed
        ? 'reading'
        : fulfilled
          ? 'fulfilled'
          : 'invocation';

  const orbitState = view === 'asking' ? 'reading' : view === 'fulfilled' ? 'fulfilled' : 'idle';
  const hero = view === 'invocation' || view === 'fulfilled';
  const composerMeta =
    used > 0 ? `${used} of ${initial.questionLimit} today` : linkedSources || `0 of ${initial.questionLimit} today`;

  const nothingToRead = openingObservation?.type === 'observation' && openingObservation.evidenceRef === 'dossier.empty';

  const nodes: [OrbitNode, OrbitNode, OrbitNode] = [
    { label: 'Calendar' },
    { label: 'Spotify' },
    {
      accent: true,
      label: fulfilled
        ? `Fulfilled · ${contactLabel('contact' in fulfilled.checkCondition ? `people.${fulfilled.checkCondition.contact}` : undefined)}`
        : nothingToRead
          ? 'Listening'
          : `Pattern · ${contactLabel(openingObservation?.type === 'observation' ? openingObservation.evidenceRef : undefined)}`,
    },
  ];

  // Latest exchange (answer / asking views): the last user turn and what follows.
  const exchange = hasQuestions ? turns.slice(lastUserIndex) : [];
  const earlier = hasQuestions ? turns.slice(0, lastUserIndex) : [];
  const previousMorrow = [...earlier].reverse().find((t) => t.role === 'assistant');
  const previousLine =
    previousMorrow?.headline && previousMorrow.prophecyRefs.length === 0
      ? previousMorrow.headline
      : (made?.statement ?? previousMorrow?.headline);
  const liveSteps = exchange.find((t) => t.role === 'assistant')?.steps ?? [];

  return (
    <main className="relative mx-auto flex min-h-[calc(100dvh-80px)] w-full max-w-[1440px] flex-col px-6 lg:min-h-[calc(100dvh-88px)] lg:px-[120px]">
      {/* Orbit: large hero diagram (01/03) or compact conversation diagram (02/06/07). */}
      {hero ? (
        <div className="pointer-events-none mx-auto mt-2 w-[220px] sm:w-[320px] lg:absolute lg:right-[90px] lg:top-2 lg:mt-0 lg:w-[660px]">
          <Orbit state={orbitState} nodes={nodes} showLabels className="hidden lg:block" />
          <Orbit state={orbitState} nodes={nodes} className="lg:hidden" />
        </div>
      ) : (
        <div className="pointer-events-none mx-auto mt-2 flex w-[180px] flex-col items-center gap-6 lg:absolute lg:right-[100px] lg:top-[148px] lg:mt-0 lg:w-[440px]">
          <Orbit state={orbitState} nodes={nodes} />
          <div className="hidden items-center gap-2.5 lg:flex">
            <span className="size-[5px] rounded-full bg-accent" />
            <span className="label-sm text-text-muted">
              {view === 'asking' ? `Consulting ${linkedCount} sources` : readingCaption}
            </span>
          </div>
        </div>
      )}

      <div
        className={`relative flex flex-1 flex-col pb-10 ${
          hero ? 'pt-8 lg:w-[600px] lg:pt-[108px]' : 'pt-8 lg:w-[700px] lg:justify-center lg:pt-10'
        }`}
      >
        {view === 'invocation' && (
          <div className="flex flex-col">
            <h1 className="font-serif text-display-m lg:w-[560px] lg:text-display">
              The day is leaning toward you.
            </h1>
            <p className="max-w-[420px] pt-5 text-body-m text-text-secondary lg:pt-6 lg:text-[16px] lg:leading-[26px]">
              {greeting(getLocalParts(new Date(initial.now), tz).hour)}, {user.name}.{' '}
              {nothingToRead
                ? 'I can barely see your days yet. Link a source and I will start to read them.'
                : 'I read your week while you slept. There is one pattern worth your attention.'}
            </p>
            <IndexList
              className="mt-10 lg:mt-12"
              items={[
                { label: "Draw today's reading", onSelect: () => setRevealed(true) },
                { label: 'What am I not seeing?', onSelect: () => send('What am I not seeing?'), disabled: limitReached },
                { label: "Did last week's prophecy land?", onSelect: () => send("Did last week's prophecy land?"), disabled: limitReached },
              ]}
            />
          </div>
        )}

        {view === 'fulfilled' && fulfilled && (
          <div className="flex flex-col">
            <h1 className="font-serif text-display-m lg:w-[560px] lg:text-display">{opening?.headline}</h1>
            {opening?.body[0] && (
              <p className="max-w-[540px] pt-5 text-body-m text-text-secondary lg:pt-6 lg:text-[16px] lg:leading-[26px]">
                {opening.body[0]}
              </p>
            )}
            <div className="flex gap-10 pt-8 lg:gap-12">
              <Stat label="Foretold" value={formatShortDate(fulfilled.madeOn)} />
              <Stat label="Fulfilled" value={shortDateOf(fulfilled.resolvedAt ?? initial.now, tz)} accent />
              <Stat label="Record" value={`${record.fulfilled} / ${record.total}`} />
            </div>
            <IndexList
              className="mt-9"
              items={[
                { label: 'What comes next?', onSelect: () => send('What comes next?'), disabled: limitReached },
                { label: 'Help me write back', onSelect: () => send('Help me write back'), disabled: limitReached },
                { label: 'Show my track record', onSelect: () => send('Show my track record'), disabled: limitReached },
              ]}
            />
          </div>
        )}

        {view === 'reading' && opening && (
          <div className="flex flex-col gap-9">
            <TurnView
              turn={{ ...opening, id: 'draw', role: 'user', headline: "Draw today's reading.", body: [], prophecyRefs: [] }}
              prophecies={[]}
              timeZone={tz}
            />
            <TurnView turn={opening} prophecies={initial.prophecies} timeZone={tz} />
          </div>
        )}

        {(view === 'asking' || view === 'answer') && (
          <div className="flex flex-col gap-9">
            {earlier.length > 0 && (
              <button
                type="button"
                onClick={() => setShowEarlier((s) => !s)}
                className="label-sm self-start text-text-muted transition-colors hover:text-text-secondary"
              >
                {showEarlier ? '↓ Hide earlier' : `↑ Earlier today — ${earlier.length} ${earlier.length === 1 ? 'turn' : 'turns'}`}
              </button>
            )}
            {showEarlier && <Transcript turns={earlier} prophecies={initial.prophecies} timeZone={tz} />}

            {view === 'asking' && previousLine && !showEarlier && (
              <div className="flex flex-col gap-2.5 opacity-35">
                <span className="label text-accent">Morrow{previousMorrow ? ` — ${previousMorrow.time}` : ''}</span>
                <p className="font-serif text-prophecy-m lg:text-prophecy">{previousLine}</p>
              </div>
            )}

            {exchange.map((t) =>
              t.role === 'user' ? (
                <div key={t.id} className="flex flex-col gap-2">
                  <span className="label text-text-muted">You — {t.time}</span>
                  <p className={view === 'asking' ? 'text-body-lg-m lg:text-body-lg' : 'text-body-m lg:text-body'}>{t.headline}</p>
                </div>
              ) : t.headline ? (
                <TurnView key={t.id} turn={t} prophecies={initial.prophecies} timeZone={tz} />
              ) : null,
            )}
            {view === 'asking' && <ReadingSteps steps={liveSteps} />}
          </div>
        )}

        {errorKind === 'reading_sealed' && (
          <p className="pt-6 text-sm text-text-secondary">
            This reading was sealed at dawn.{' '}
            <button type="button" className="underline" onClick={() => router.refresh()}>
              Open today&apos;s reading
            </button>
          </p>
        )}
        {errorKind === 'other' && (
          <p className="pt-6 text-sm text-text-secondary">Morrow lost the thread. Try asking again.</p>
        )}
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 bg-gradient-to-t from-bg from-60% to-transparent px-4 pb-[30px] pt-6 lg:mx-0 lg:px-0 lg:pb-10">
        <Composer
          state={busy ? 'waiting' : input ? 'typing' : 'idle'}
          value={input}
          onChange={setInput}
          onSubmit={send}
          onStop={() => void chat.stop()}
          meta={composerMeta}
          metaCompact={`${used}/${initial.questionLimit}`}
          disabled={limitReached}
          placeholder={
            limitReached
              ? 'Morrow has answered fifteen questions today. It speaks again at dawn.'
              : 'Ask Morrow anything about the days ahead'
          }
        />
      </div>
    </main>
  );
}
