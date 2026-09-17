'use client';

import type { ConnectSourceResponse, MeResponse, Source, SourceKind } from '@morrow/core';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FirstReading } from './FirstReading';

type Props = { initialSources: Source[]; connectError: string | null };

const CARDS: { kind: SourceKind; name: string; glyph: string; reads: string; never: string; hint: string; found: (n: number, calendars?: number) => string }[] = [
  {
    kind: 'calendar',
    name: 'Google Calendar',
    glyph: 'CA',
    reads: "What's on every calendar, who's invited, what moves.",
    never: 'Attachments, video-call links, other people’s private events.',
    hint: 'Start here',
    found: (n, calendars) =>
      `${n.toLocaleString('en-US')} ${n === 1 ? 'event' : 'events'} found${calendars ? ` · ${calendars} ${calendars === 1 ? 'calendar' : 'calendars'}` : ''} · last 90 days`,
  },
  {
    kind: 'spotify',
    name: 'Spotify',
    glyph: 'SP',
    reads: 'What you play, and when.',
    never: 'Messages, followers, your profile.',
    hint: 'Recommended',
    found: (n) => `${n.toLocaleString('en-US')} ${n === 1 ? 'play' : 'plays'} found · recently played`,
  },
  {
    kind: 'mail',
    name: 'Gmail',
    glyph: 'MA',
    reads: "Who you write to, what threads are about, what's waiting on a reply.",
    never: 'Promotions, social, spam. Messages are read once into notes, then deleted.',
    hint: 'Deepest reading',
    found: (n) => `${n.toLocaleString('en-US')} ${n === 1 ? 'message' : 'messages'} found · last 14 days`,
  },
];

const LATER = [
  { glyph: 'IG', name: 'Instagram', reads: 'Who you keep up with, the places you return to.' },
];

const isLinked = (s: Source | undefined) => Boolean(s && s.status !== 'not_linked');

function SourceCard({ card, source, onConnect, pending }: { card: (typeof CARDS)[number]; source: Source | undefined; onConnect: () => void; pending: boolean }) {
  const linked = isLinked(source);
  const reauth = source?.syncState === 'needs_reauth' || source?.status === 'error';
  const syncing = linked && !reauth && (source?.syncState === 'pending' || source?.syncState === 'syncing' || !source?.lastSyncedAt);
  const meta = !linked
    ? card.hint
    : reauth
      ? 'Needs reconnecting'
      : syncing
        ? 'Reading…'
        : card.found(source?.eventCount ?? source?.stat?.value ?? 0, source?.calendarCount);

  return (
    <div
      className={`flex flex-col gap-3.5 rounded-card border bg-panel px-[22px] py-5 ${
        linked && !reauth ? 'border-accent-border' : 'border-hairline'
      }`}
    >
      <div className="flex items-center gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-glyph border border-hairline-strong font-mono text-label text-text-primary">
          {card.glyph}
        </span>
        <span className="flex min-w-0 grow flex-col gap-1">
          <span className="font-serif text-[26px] leading-7 text-text-primary">{card.name}</span>
          <span className={`font-mono text-label-sm uppercase tracking-[0.02em] ${syncing ? 'text-accent' : 'text-text-muted'}`}>{meta}</span>
        </span>
        {linked && !reauth ? (
          <span className="label-sm flex shrink-0 items-center gap-2 text-accent">
            <span className="size-[7px] rounded-full bg-accent" /> Linked
          </span>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            disabled={pending}
            className="flex h-9 shrink-0 items-center rounded-button border border-hairline-strong px-4 text-sm font-medium text-text-primary transition-colors hover:border-text-muted disabled:opacity-60"
          >
            {pending ? 'Opening…' : reauth ? 'Reconnect' : 'Connect'}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-3 border-t border-hairline pt-3.5 sm:flex-row sm:gap-6">
        <div className="flex flex-col gap-1 sm:w-[340px] sm:shrink-0">
          <span className="font-mono text-[10px] uppercase leading-3 tracking-[0.04em] text-text-muted">Reads</span>
          <span className="text-sm text-text-secondary">{card.reads}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase leading-3 tracking-[0.04em] text-text-muted">Never</span>
          <span className="text-sm text-text-secondary">{card.never}</span>
        </div>
      </div>
    </div>
  );
}

/** Screen 14 body: steps, source cards, "later" list, CTA → first reading (step 3). */
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

  // Linked cards show real counts once the on-connect sync lands.
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
    <main className="mx-auto w-full max-w-[1440px] px-6 pb-16 pt-8 lg:grid lg:grid-cols-[360px_minmax(0,760px)] lg:gap-[80px] lg:px-[120px] lg:pt-[82px]">
      <div className="flex flex-col">
        <span className="label text-text-muted">Step 2 of 3</span>
        <h1 className="pt-5 font-serif text-title-m lg:pt-[22px] lg:text-[68px] lg:leading-[66px] lg:tracking-[-0.015em]">
          What may Morrow read?
        </h1>
        <p className="max-w-[330px] pt-5 text-[15px] leading-6 text-text-secondary">
          Start with what you're comfortable sharing. The more Morrow can read, the less it has to guess.
        </p>
        <ol className="flex flex-col gap-3 pt-9">
          {[
            { glyph: '✓', label: 'Sign in', tone: 'text-text-muted' },
            { glyph: '●', label: 'Connect sources', tone: 'text-accent' },
            { glyph: '○', label: 'First reading', tone: 'text-text-faint' },
          ].map((s) => (
            <li key={s.label} className={`flex items-center gap-3 font-mono text-label-sm ${s.tone}`}>
              <span className="w-3.5 shrink-0">{s.glyph}</span>
              <span className="uppercase tracking-[0.04em]">{s.label}</span>
            </li>
          ))}
        </ol>
      </div>

      <section className="mt-12 flex flex-col lg:mt-0">
        <div className="flex flex-col gap-3">
          {CARDS.map((card) => (
            <SourceCard key={card.kind} card={card} source={byKind(card.kind)} pending={pendingKind === card.kind} onConnect={() => void connect(card.kind)} />
          ))}
        </div>
        {error && <p className="pt-4 text-sm text-danger">{error}</p>}

        <div className="flex flex-col pt-12">
          <span className="label-sm pb-2.5 text-text-muted">Later · Morrow asks when a prophecy needs it</span>
          <ul className="border-b border-dashed border-hairline-strong">
            {LATER.map((l) => (
              <li key={l.name} className="flex items-center gap-4 border-t border-dashed border-hairline-strong py-3.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-[8px] border border-dashed border-hairline-strong font-mono text-label-sm text-text-muted">
                  {l.glyph}
                </span>
                <span className="w-[120px] shrink-0 font-serif text-[21px] leading-[26px] text-text-secondary sm:w-[180px]">{l.name}</span>
                <span className="grow text-sm text-text-muted">{l.reads}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col-reverse gap-5 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <span className="label-sm text-text-muted">
            {linkedCount} of {CARDS.length} linked · add more anytime
          </span>
          <div className="flex items-center justify-end gap-[18px]">
            <button type="button" onClick={() => setDrawing(true)} className="text-sm text-text-muted transition-colors hover:text-text-secondary">
              Skip for now
            </button>
            <button
              type="button"
              onClick={() => setDrawing(true)}
              disabled={linkedCount === 0}
              className="flex h-[46px] items-center gap-2.5 rounded-[12px] bg-accent-fill px-5 text-[15px] font-medium leading-5 text-on-accent transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Draw my first reading
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <path d="M3 7 H11 M7.5 3.5 L11 7 L7.5 10.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
