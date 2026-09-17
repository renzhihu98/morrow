'use client';

import type { Source } from '@morrow/core';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { StepData } from '@/lib/chat-types';
import { Orbit } from '../Orbit';
import { ReadingSteps } from '../ReadingSteps';

type Props = { sources: Source[]; onCancel: () => void };

/**
 * Onboarding step 3 — the Today layout with the orbit in `reading` state while
 * POST /api/onboarding/complete syncs, distils the dossier and draws the first reading. Then → Today.
 */
export function FirstReading({ sources, onCancel }: Props) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [progress, setProgress] = useState(0);
  const started = useRef(-1);

  const STEP_COPY: Partial<Record<Source['kind'], { label: string; detail: string }>> = {
    calendar: { label: 'Calendar', detail: 'Who you make time for, what keeps moving' },
    mail: { label: 'Mail', detail: 'Who you write to, what waits on a reply' },
    spotify: { label: 'Spotify', detail: 'What you play, and when' },
  };
  const linked = sources.filter((s) => s.status !== 'not_linked' && STEP_COPY[s.kind]);
  const steps: Omit<StepData, 'status'>[] = [
    ...linked.map((s) => ({ id: s.kind, source: s.kind, ...STEP_COPY[s.kind]! })),
    { id: 'dossier', source: 'memory' as const, label: 'Dossier', detail: 'Distilling what stays' },
    { id: 'reading', source: 'memory' as const, label: 'First reading', detail: 'Choosing what to tell you' },
  ];

  useEffect(() => {
    if (started.current === attempt) return;
    started.current = attempt;
    setFailed(false);
    setProgress(0);
    const timers = steps.slice(0, -1).map((_, i) => setTimeout(() => setProgress((p) => Math.max(p, i + 1)), 2200 * (i + 1)));
    fetch('/api/onboarding/complete', { method: 'POST' })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        setProgress(steps.length);
        router.replace('/');
        router.refresh();
      })
      .catch(() => setFailed(true))
      .finally(() => timers.forEach(clearTimeout));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per attempt
  }, [attempt]);

  const items: StepData[] = steps.map((s, i) => ({ ...s, status: i < progress ? 'done' : i === progress ? 'active' : 'pending' }));

  return (
    <main className="relative mx-auto flex min-h-[calc(100dvh-88px)] w-full max-w-[1440px] flex-col px-6 lg:px-[120px]">
      <div className="pointer-events-none mx-auto mt-2 flex w-[200px] flex-col items-center gap-6 lg:absolute lg:right-[100px] lg:top-[60px] lg:mt-0 lg:w-[520px]">
        <Orbit state="reading" nodes={[{ label: 'Calendar' }, { label: 'Spotify' }, { accent: true }]} />
        <div className="hidden items-center gap-2.5 lg:flex">
          <span className="size-[5px] rounded-full bg-accent" />
          <span className="label-sm text-text-muted">
            Reading across {linked.length} {linked.length === 1 ? 'source' : 'sources'}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-10 pb-16 pt-8 lg:w-[620px] lg:pt-[120px]">
        <div className="flex flex-col">
          <h1 className="font-serif text-display-m lg:text-display">Drawing your first reading.</h1>
          <p className="max-w-[440px] pt-5 text-body-m text-text-secondary lg:text-[16px] lg:leading-[26px]">
            {linked.length > 0
              ? 'Morrow is reading what you connected. Raw events are distilled, then let go.'
              : 'Nothing is connected yet, so this first reading will be a quiet one.'}
          </p>
        </div>
        <ReadingSteps steps={items} reading={!failed} />
        {failed && (
          <p className="text-sm text-text-secondary">
            Morrow lost the thread.{' '}
            <button type="button" className="underline" onClick={() => setAttempt((a) => a + 1)}>
              Try again
            </button>{' '}
            ·{' '}
            <button type="button" className="underline" onClick={onCancel}>
              Back
            </button>
          </p>
        )}
      </div>
    </main>
  );
}
