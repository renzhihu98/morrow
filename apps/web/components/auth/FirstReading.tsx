'use client';

import type { Source } from '@morrow/core';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { MorrowMessage, UserMessage } from '../chat/MessageRow';
import { TypingBubble } from '../chat/TypingBubble';
import { CrystalBall } from '../CrystalBall';

type Props = { sources: Source[]; onCancel: () => void };

/**
 * Onboarding step 3 — the first reading being drawn, in the v4 Today frame: hero line, the ball in its
 * `reading` state, and Morrow's typing bubble while POST /api/onboarding/complete syncs, distils the
 * dossier and draws the reading. Then → Today. No source names on screen (SPEC §4.A.5).
 */
export function FirstReading({ sources, onCancel }: Props) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const started = useRef(-1);
  const anyLinked = sources.some((s) => s.status !== 'not_linked');

  useEffect(() => {
    if (started.current === attempt) return;
    started.current = attempt;
    setFailed(false);
    fetch('/api/onboarding/complete', { method: 'POST' })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        router.replace('/');
        router.refresh();
      })
      .catch(() => setFailed(true));
  }, [attempt, router]);

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-64px)] w-full max-w-[808px] flex-col px-6 pb-16 pt-8 lg:min-h-[calc(100dvh-88px)] lg:pt-[52px]">
      <h1 className="font-serif text-display-m text-text lg:max-w-[640px] lg:text-display lg:leading-[84px]">
        Drawing your first reading.
      </h1>
      <div className="flex items-center gap-4 pt-7 lg:gap-5 lg:pt-9">
        <CrystalBall size={64} variant="large" state={failed ? 'idle' : 'reading'} />
        <p className="max-w-[480px] text-body-m text-text lg:text-[17px] lg:leading-[26px]">
          {anyLinked
            ? 'I’m reading what you connected. Raw events are distilled, then let go.'
            : 'Nothing is connected yet, so this first reading will be a quiet one.'}
        </p>
      </div>
      <div className="flex flex-col gap-5 pt-12 lg:pt-14">
        <UserMessage>Draw my first reading.</UserMessage>
        <MorrowMessage state={failed ? undefined : 'reading'}>
          {failed ? (
            <p className="text-body-m text-text lg:text-body">
              I lost the thread.{' '}
              <button type="button" className="text-accent underline underline-offset-2" onClick={() => setAttempt((a) => a + 1)}>
                Try again
              </button>{' '}
              ·{' '}
              <button type="button" className="text-accent underline underline-offset-2" onClick={onCancel}>
                Back
              </button>
            </p>
          ) : (
            <TypingBubble />
          )}
        </MorrowMessage>
      </div>
    </main>
  );
}
