'use client';

import type { ConnectSourceResponse, MeResponse, Source, SourceKind } from '@morrow/core';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { StatusDot } from '@/components/Labels';
import { ArrowRight, Button } from '@/components/ui/Button';
import { FirstReading } from './FirstReading';

type Props = { initialSources: Source[]; connectError: string | null };

const CARDS: { kind: SourceKind; name: string; reads: string; never: string; hint: string; found: (n: number, calendars?: number) => string }[] = [
  {
    kind: 'calendar',
    name: 'Google Calendar',
    reads: "What's on every calendar, who's invited, what moves.",
    never: 'Attachments, video-call links, other people’s private events.',
    hint: 'Start here',
    found: (n, calendars) =>
      `${n.toLocaleString('en-US')} ${n === 1 ? 'event' : 'events'} found${calendars ? ` · ${calendars} ${calendars === 1 ? 'calendar' : 'calendars'}` : ''} · last 90 days`,
  },
  {
    kind: 'spotify',
    name: 'Spotify',
    reads: 'What you play, and when.',
    never: 'Messages, followers, your profile.',
    hint: 'Recommended',
    found: (n) => `${n.toLocaleString('en-US')} ${n === 1 ? 'play' : 'plays'} found · recently played`,
  },
  {
    kind: 'mail',
    name: 'Gmail',
    reads: "Who you write to, what threads are about, what's waiting on a reply.",
    never: 'Promotions, social, spam. Messages are read once into notes, then deleted.',
    hint: 'Deepest reading',
    found: (n) => `${n.toLocaleString('en-US')} ${n === 1 ? 'message' : 'messages'} found · last 14 days`,
  },
];

const LATER = [{ name: 'Instagram', reads: 'Who you keep up with, the places you return to.' }];

const STEPS = [
  { label: 'Sign in', state: 'done' },
  { label: 'Connect sources', state: 'current' },
  { label: 'First reading', state: 'next' },
] as const;

const isLinked = (s: Source | undefined) => Boolean(s && s.status !== 'not_linked');

function StepMark({ state }: { state: (typeof STEPS)[number]['state'] }) {
  if (state === 'done')
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
        <path d="M2 6.5 L5 9 L10 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  return <span className={`size-2 rounded-full ${state === 'current' ? 'bg-accent' : 'border border-text-muted'}`} />;
}

function SourceSection({ card, source, onConnect, pending }: { card: (typeof CARDS)[number]; source: Source | undefined; onConnect: () => void; pending: boolean }) {
  const linked = isLinked(source);
  const reauth = source?.syncState === 'needs_reauth' || source?.status === 'error';
  const syncing = linked && !reauth && (source?.syncState === 'pending' || source?.syncState === 'syncing' || !source?.lastSyncedAt);
  const found = linked && !reauth && !syncing;
  const meta = !linked
    ? card.hint
    : reauth
      ? 'Needs reconnecting'
      : syncing
        ? 'Reading…'
        : card.found(source?.eventCount ?? source?.stat?.value ?? 0, source?.calendarCount);

  return (
    <section className="flex flex-col gap-4 border-t border-hairline py-5" aria-label={card.name}>
      <div className="flex items-center gap-4">
        <div className="flex min-w-0 grow flex-col gap-0.5">
          <h2 className="font-serif text-[28px] leading-8 tracking-[-0.01em] text-text lg:text-[34px] lg:leading-[38px]">{card.name}</h2>
          <span
            className={
              found ? 'font-mono text-meta text-text-muted' : `label ${syncing ? 'text-accent' : 'text-text-muted'}`
            }
          >
            {meta}
          </span>
        </div>
        {linked && !reauth ? (
          <span className="flex h-9 shrink-0 items-center gap-2 rounded-[18px] bg-surface pl-3.5 pr-4 text-[14px] font-medium leading-[18px] text-text">
            <StatusDot /> Linked
          </span>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            disabled={pending}
            className="inline-flex h-10 shrink-0 items-center rounded-[20px] border border-accent px-5 text-[15px] font-medium leading-[18px] text-accent transition-opacity hover:bg-accent/5 disabled:opacity-50"
          >
            {pending ? 'Opening…' : reauth ? 'Reconnect' : 'Connect'}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:gap-8">
        <div className="flex flex-col gap-1.5 sm:w-[250px] sm:shrink-0">
          <span className="label text-text-muted">Reads</span>
          <span className="text-[15px] leading-[22px] text-text">{card.reads}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="label text-text-muted">Never</span>
          <span className="text-[15px] leading-[22px] text-text">{card.never}</span>
        </div>
      </div>
    </section>
  );
}

/** 02 Connect accounts body (Paper v4 BW0-0): steps, source sections, "Later", CTA → first reading (step 3). */
export function ConnectAccounts({ initialSources, connectError }: Props) {
  const router = useRouter();
  const [sources, setSources] = useState(initialSources);
  const [pendingKind, setPendingKind] = useState<SourceKind | null>(null);
  const [error, setError] = useState<string | null>(connectError ? `${connectError === 'spotify' ? 'Spotify' : connectError === 'mail' ? 'Gmail' : 'Google Calendar'} wasn't connected. Try again.` : null);
  const [drawing, setDrawing] = useState(false);

  const byKind = (k: SourceKind) => sources.find((s) => s.kind === k);
  const linkedCount = CARDS.filter((c) => isLinked(byKind(c.kind))).length;
  const waiting = CARDS.some((c) => {
    const s = byKind(c.kind);
    return isLinked(s) && s?.syncState !== 'needs_reauth' && (s?.syncState === 'pending' || s?.syncState === 'syncing' || !s?.lastSyncedAt);
  });

  // Linked sections show real counts once the on-connect sync lands.
  useEffect(() => {
    if (!waiting) return;
    let stop = false;
    let tries = 0;
    const tick = async () => {
      if (stop || tries++ > 60) return;
      const res = await fetch('/api/me', { cache: 'no-store' }).catch(() => null);
      if (res?.ok && !stop) setSources(((await res.json()) as MeResponse).sources);
      if (!stop) setTimeout(tick, 2000);
    };
    const t = setTimeout(tick, 1500);
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [waiting]);

  const connect = async (kind: SourceKind) => {
    setPendingKind(kind);
    setError(null);
    const res = await fetch(`/api/sources/${kind}/connect`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ callbackURL: '/welcome/sources' }),
    }).catch(() => null);
    const body = res?.ok ? ((await res.json()) as ConnectSourceResponse) : null;
    const url = body?.url ?? body?.authorizeUrl;
    if (url) return window.location.assign(url);
    setPendingKind(null);
    if (body) return router.refresh();
    setError('That source can’t be connected right now. Try again in a moment.');
  };

  if (drawing) return <FirstReading sources={sources} onCancel={() => setDrawing(false)} />;

  return (
    <main className="mx-auto flex w-full max-w-[1088px] flex-col px-6 pb-12 pt-6 lg:box-content lg:flex-row lg:items-start lg:justify-between lg:gap-10 lg:px-12 lg:pt-8">
      <div className="flex flex-col lg:w-[420px] lg:shrink-0">
        <span className="label text-text-muted">Step 2 of 3</span>
        <h1 className="pt-4 font-serif text-title-m text-text lg:pt-5 lg:text-[88px] lg:leading-[84px] lg:tracking-[-0.02em]">
          What may Morrow read?
        </h1>
        <p className="max-w-[340px] pt-5 text-[16px] leading-6 text-text lg:pt-7 lg:text-[17px] lg:leading-[26px]">
          Start with what you&apos;re comfortable sharing. The more Morrow can read, the less it has to guess.
        </p>
        <ol className="flex flex-col pt-8 lg:w-[380px] lg:pt-10">
          {STEPS.map((s) => (
            <li
              key={s.label}
              aria-current={s.state === 'current' ? 'step' : undefined}
              className={`flex h-10 items-center gap-3.5 border-t border-hairline text-[15px] leading-5 last:border-b ${
                s.state === 'current' ? 'font-medium text-accent' : 'text-text-muted'
              }`}
            >
              <span className="flex w-4 shrink-0 justify-center">
                <StepMark state={s.state} />
              </span>
              {s.label}
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-12 flex min-w-0 flex-col lg:mt-0 lg:w-[620px] lg:shrink-0 lg:pt-2">
        {CARDS.map((card) => (
          <SourceSection
            key={card.kind}
            card={card}
            source={byKind(card.kind)}
            pending={pendingKind === card.kind}
            onConnect={() => void connect(card.kind)}
          />
        ))}
        {error && (
          <p role="alert" className="pb-4 text-[14px] leading-5 text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3 border-t border-hairline pt-6">
          <span className="label text-text-muted">Later — Morrow asks when a prophecy needs it</span>
          {LATER.map((l) => (
            <div key={l.name} className="flex flex-col gap-1 pt-1 sm:flex-row sm:items-center sm:gap-[18px]">
              <span className="font-serif text-[26px] leading-[30px] text-text-muted sm:w-[264px] sm:shrink-0">{l.name}</span>
              <span className="text-[15px] leading-[22px] text-text-muted">{l.reads}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col-reverse gap-5 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-mono text-meta text-text-muted">
            {linkedCount} of {CARDS.length} linked · add more anytime
          </span>
          <div className="flex items-center justify-between gap-7 sm:justify-end">
            <Button variant="link" onClick={() => setDrawing(true)}>
              Skip for now
            </Button>
            <Button onClick={() => setDrawing(true)} disabled={linkedCount === 0}>
              Draw my first reading
              <ArrowRight />
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
