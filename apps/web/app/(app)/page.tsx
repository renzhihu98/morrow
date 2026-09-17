import { prophecyRecord } from '@morrow/core';
import { after, connection } from 'next/server';
import { Suspense } from 'react';
import { Orbit } from '@/components/Orbit';
import { Today } from '@/components/Today';
import { requirePageUser, toCoreUser } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { now } from '@/lib/server/env';
import { syncIfStale } from '@/lib/jobs/sync-on-visit';
import { getTodayView } from '@/lib/server/readings';
import { SOURCE_ABBR } from '@/lib/sources/catalog';

/** Today (screens 01/02/03/06/07). Same payload as GET /api/today, built server-side. */
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
    <main className="flex min-h-[70dvh] flex-col items-center justify-center gap-8 px-6" aria-busy="true">
      <div className="w-[240px] sm:w-[320px]" aria-hidden>
        <Orbit state="reading" nodes={[{}, {}, { accent: true }]} />
      </div>
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="label animate-pulse text-accent">Drawing today’s reading</span>
        <p className="max-w-[320px] font-serif text-row-m text-text-secondary">Morrow is reading your week. This takes a moment, once a day.</p>
      </div>
    </main>
  );
}

async function TodayContent() {
  const user = toCoreUser(await requirePageUser());
  const repo = getRepository();
  const today = await getTodayView(repo, user, now());
  after(() => syncIfStale(repo, user, new Date()));
  const [sources, prophecies] = await Promise.all([repo.listSources(today.user.id), repo.listProphecies(today.user.id)]);
  const linked = sources.filter((s) => s.status === 'linked');
  const events = linked.reduce((n, s) => n + (s.stat?.label === 'events' ? s.stat.value : 0), 0);
  const record = prophecyRecord(prophecies);

  return (
    <Today
      key={today.reading.id}
      initial={today}
      linkedAbbr={linked.map((s) => SOURCE_ABBR[s.kind]).join(' · ')}
      linkedCount={linked.length}
      readingCaption={
        events > 0 ? `Reading ${events} events across ${linked.length} sources` : `Reading across ${linked.length} sources`
      }
      record={{ fulfilled: record.fulfilled, total: record.marks.length }}
    />
  );
}
