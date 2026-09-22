'use client';

import { useChat } from '@ai-sdk/react';
import { formatLocalTime, formatShortDate, getLocalParts, type Prophecy, type TodayResponse } from '@morrow/core';
import { DefaultChatTransport, generateId } from 'ai';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MorrowUIMessage } from '@/lib/chat-types';
import { numberWord, shortDateOf } from '@/lib/ui/format';
import { ChatLayout, dayLabel, FigureColumn, FulfilledRail, PromptPills } from './chat/ChatLayout';
import { DayDivider } from './chat/DayDivider';
import { UserMessage } from './chat/MessageRow';
import { Composer } from './Composer';
import { CrystalBall } from './CrystalBall';
import { Transcript, TurnView, turnFromMessage, type Turn } from './Transcript';

type Props = {
  initial: TodayResponse;
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

/** `people.sam` in a check condition → `Sam`. */
function contactOf(p: Prophecy): string | null {
  const c = p.checkCondition;
  if (!('contact' in c) || !c.contact || c.contact === 'any') return null;
  return c.contact.replace(/_/g, ' ').replace(/(^|\s)\S/g, (s) => s.toUpperCase());
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const greeting = (hour: number) => (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');

const SUGGESTIONS = ['What am I not seeing?', "Did last week's prophecy land?"] as const;
const FOLLOW_UPS = ['What comes next?', 'Help me write back', 'Show my track record'] as const;

/**
 * Today (Paper 03 ASB-0 → 04 B8E-0 / 05 BE5-0 / 06 AST-0, or 07 C1G-0 on a day a prophecy landed).
 * One route; the view follows the conversation.
 */
export function Today({ initial, record }: Props) {
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
  const endRef = useRef<HTMLDivElement>(null);

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

  // Live turns. `data-step` parts keep streaming but are never shown (SPEC §4.A.5).
  const liveMessages = chat.messages.filter((m) => !storedIds.has(m.id));
  const live: Turn[] = liveMessages.map((m, i) => {
    const texts = m.parts.flatMap((p) => (p.type === 'text' && p.text ? [p.text] : []));
    const observation = m.parts.find((p) => p.type === 'data-observation')?.data.text;
    const paragraphs = m.role === 'user' ? [texts.join('')] : [observation, ...texts].filter((t): t is string => Boolean(t));
    const last = i === liveMessages.length - 1;
    return {
      id: m.id,
      role: m.role === 'user' ? 'user' : 'assistant',
      time: stamp(m.id),
      paragraphs,
      prophecyRefs: [],
      thinking: m.role !== 'user' && paragraphs.length === 0,
      streaming: busy && last,
    } satisfies Turn;
  });
  // Submitted, nothing streamed back yet: Morrow is reading.
  if (busy && live.at(-1)?.role === 'user') {
    live.push({ id: 'pending', role: 'assistant', time: stamp(`pending-${live.length}`), paragraphs: [], prophecyRefs: [], thinking: true, streaming: true });
  }

  const opening = stored[0]?.role === 'assistant' ? stored[0] : undefined;
  const rest = opening ? stored.slice(1) : stored;
  const turns = [...rest, ...live];
  const hasQuestions = turns.some((t) => t.role === 'user');

  const fulfilledId = opening?.prophecyRefs.find((r) => r.event === 'fulfilled')?.prophecyId;
  const fulfilled = fulfilledId ? initial.prophecies.find((p) => p.id === fulfilledId) : undefined;

  const openingMessage = initial.messages[0];
  const nothingToRead =
    openingMessage?.parts.some((p) => p.type === 'observation' && p.evidenceRef === 'dossier.empty') ?? false;

  const send = (text: string) => {
    if (busy || limitReached) return;
    setRevealed(true);
    setInput('');
    chat.clearError();
    void chat.sendMessage({ text });
  };

  // Open on the newest message when today's conversation has already begun.
  const resumed = useRef(hasQuestions);
  useEffect(() => {
    if (resumed.current) endRef.current?.scrollIntoView({ block: 'end' });
  }, []);

  // Keep the newest message in view while the conversation moves.
  const lastLength = turns.at(-1)?.paragraphs.join('').length ?? 0;
  useEffect(() => {
    if (chat.messages.length === 0 && !revealed) return;
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [chat.messages.length, turns.length, lastLength, revealed]);

  type View = 'invocation' | 'fulfilled' | 'chat';
  const view: View = hasQuestions || revealed ? 'chat' : fulfilled ? 'fulfilled' : 'invocation';
  const showCount = view === 'chat' || used > 0;

  const composer = (
    <Composer
      state={busy ? 'waiting' : input ? 'typing' : 'idle'}
      value={input}
      onChange={setInput}
      onSubmit={send}
      onStop={() => void chat.stop()}
      count={showCount ? { used, limit: initial.questionLimit } : undefined}
      disabled={limitReached}
      placeholder={
        limitReached
          ? 'Morrow has answered fifteen questions today. It speaks again at dawn.'
          : 'Ask Morrow anything about the days ahead'
      }
    />
  );

  const errors = (
    <>
      {errorKind === 'reading_sealed' && (
        <p className="text-body-m text-text lg:text-body">
          This reading was sealed at dawn.{' '}
          <button type="button" className="text-accent underline underline-offset-2" onClick={() => router.refresh()}>
            Open today&apos;s reading
          </button>
        </p>
      )}
      {errorKind === 'other' && <p className="text-body-m text-text lg:text-body">Morrow lost the thread. Try asking again.</p>}
    </>
  );

  // ── 03 Invocation ──────────────────────────────────────────────────────────
  if (view === 'invocation') {
    return (
      <main className="mx-auto flex min-h-[calc(100dvh-64px)] w-full max-w-[808px] flex-col px-6 lg:min-h-[calc(100dvh-88px)]">
        <div className="flex flex-1 flex-col pb-10 pt-8 lg:pt-[52px]">
          <span className="label text-text-muted">{dayLabel(reading.localDate)}</span>
          <h1 className="pt-4 font-serif text-display-m text-text lg:max-w-[640px] lg:pt-5 lg:text-display lg:leading-[84px]">
            {opening?.paragraphs[0] ?? reading.headline}
          </h1>
          <div className="flex items-center gap-4 pt-7 lg:gap-5 lg:pt-9">
            <CrystalBall size={64} variant="large" state="idle" />
            <p className="max-w-[480px] text-body-m text-text lg:text-[17px] lg:leading-[26px]">
              {greeting(getLocalParts(new Date(initial.now), tz).hour)}, {user.name}.{' '}
              {nothingToRead
                ? 'I can barely see your days yet. Link a source and I will start to read them.'
                : 'I read your week while you slept. There is one pattern worth your attention.'}
            </p>
          </div>
          <ul className="flex flex-col pt-9 lg:pt-11">
            {[
              { label: "Draw today's reading", onSelect: () => setRevealed(true), disabled: false },
              ...SUGGESTIONS.map((q) => ({ label: q, onSelect: () => send(q), disabled: limitReached })),
            ].map((s, i) => (
              <li key={s.label} className={`border-b border-hairline ${i === 0 ? 'border-t' : ''}`}>
                <button
                  type="button"
                  onClick={s.onSelect}
                  disabled={s.disabled}
                  className="flex h-[60px] w-full items-center text-left text-body-m text-text transition-colors hover:text-accent disabled:opacity-50 lg:text-[17px] lg:leading-[22px]"
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
          <div className="pt-6">{errors}</div>
        </div>
        <div className="sticky bottom-0 z-10 -mx-1 bg-bg px-1 pb-6 pt-2.5 lg:pb-[30px]">{composer}</div>
      </main>
    );
  }

  // ── 07 Prophecy fulfilled / 04 Reading / 05 Asking / 06 Answer ────────────
  const aside =
    view === 'fulfilled' && fulfilled ? (
      <FulfilledRail
        label={['Fulfilled', contactOf(fulfilled)].filter(Boolean).join(' · ')}
        headline={`${cap(numberWord(record.fulfilled))} of ${numberWord(record.total)} have landed.`}
        rows={[
          { label: 'Foretold', value: formatShortDate(fulfilled.madeOn) },
          { label: 'Fulfilled', value: shortDateOf(fulfilled.resolvedAt ?? initial.now, tz), strong: true },
          { label: 'Record', value: `${record.fulfilled} / ${record.total}` },
        ]}
      />
    ) : (
      <FigureColumn
        caption={
          !hasQuestions && opening ? (
            <>
              Today&apos;s reading · <span className="font-mono">{opening.time}</span>
            </>
          ) : undefined
        }
      />
    );

  return (
    <ChatLayout aside={aside} composer={composer}>
      <DayDivider label={dayLabel(reading.localDate)} />
      {opening && !fulfilled && <UserMessage>Draw today&apos;s reading.</UserMessage>}
      {opening && (
        <TurnView
          turn={opening}
          prophecies={initial.prophecies}
          timeZone={tz}
          after={
            view === 'fulfilled' ? <PromptPills prompts={[...FOLLOW_UPS]} onSelect={send} disabled={limitReached} /> : undefined
          }
        />
      )}
      <Transcript turns={turns} prophecies={initial.prophecies} timeZone={tz} />
      {errors}
      <div ref={endRef} aria-hidden className="scroll-mb-28" />
    </ChatLayout>
  );
}
