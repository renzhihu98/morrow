import { prophecyRecord } from '@morrow/core';
import { connection } from 'next/server';
import { Today } from '@/components/Today';
import { getRepository } from '@/lib/data';
import { now } from '@/lib/server/env';
import { getTodayView } from '@/lib/server/readings';
import { SOURCE_ABBR } from '@/lib/sources/catalog';

/** Today (screens 01/02/03/06/07). Same payload as GET /api/today, built server-side. */
export default async function TodayPage() {
  await connection();
  const repo = getRepository();
  const today = await getTodayView(repo, now());
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
