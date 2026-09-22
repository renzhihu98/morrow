import { prophecyRecord } from '@morrow/core';
import { after, connection } from 'next/server';
import { Suspense } from 'react';
import { CrystalBall } from '@/components/CrystalBall';
import { Today } from '@/components/Today';
import { requirePageUser, toCoreUser } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { now } from '@/lib/server/env';
import { syncIfStale } from '@/lib/jobs/sync-on-visit';
import { getTodayView } from '@/lib/server/readings';

/** Today (v4 screens 03–07). Same payload as GET /api/today, built server-side. */
export default async function TodayPage() {
  await connection();
  return (
    <Suspense fallback={<DrawingToday />}>
      <TodayContent />
    </Suspense>
  );
}

/** Shown while today's reading is drawn (the first visit of the day can take half a minute). */
function DrawingToday() {
  return (
    <main className="flex min-h-[70dvh] flex-col items-center justify-center gap-6 px-6" aria-busy="true">
      <CrystalBall size={72} variant="large" state="reading" />
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="label text-text-muted">Drawing today&apos;s reading</span>
        <p className="max-w-[320px] font-serif text-row-m text-text lg:text-row">
          Morrow is reading your week. This takes a moment, once a day.
        </p>
      </div>
    </main>
  );
}

async function TodayContent() {
  const user = toCoreUser(await requirePageUser());
  const repo = getRepository();
  const today = await getTodayView(repo, user, now());
  after(() => syncIfStale(repo, user, new Date()));
  const record = prophecyRecord(await repo.listProphecies(today.user.id));

  return <Today key={today.reading.id} initial={today} record={{ fulfilled: record.fulfilled, total: record.marks.length }} />;
}
