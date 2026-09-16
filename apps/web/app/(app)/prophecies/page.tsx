import { formatShortDate, type Prophecy } from '@morrow/core';
import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { PageIntro, Stat } from '@/components/Labels';
import { ProphecyCard, ResolvedRow } from '@/components/Prophecy';
import { RecordMarks } from '@/components/RecordMarks';
import { requirePageUser, toCoreUser } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { now as serverNow } from '@/lib/server/env';
import { getProphecyListView } from '@/lib/server/readings';
import { pad2, shortDateOf } from '@/lib/ui/format';

export const metadata: Metadata = { title: 'Prophecies' };

const RESOLVED_PREVIEW = 3;

export default async function PropheciesPage({ searchParams }: PageProps<'/prophecies'>) {
  await connection();
  const showAll = (await searchParams).all === '1';
  const repo = getRepository();
  const user = toCoreUser(await requirePageUser());
  const now = serverNow();
  const { open, resolved, record } = await getProphecyListView(repo, user);
  const all: Prophecy[] = [...open, ...resolved];
  const made = all.length;
  const recordSince = [...all].sort((a, b) => a.number - b.number).slice(-record.marks.length)[0]?.madeOn;
  const shown = showAll ? resolved : resolved.slice(0, RESOLVED_PREVIEW);

  return (
    <main className="mx-auto w-full max-w-[1440px] px-6 pb-20 pt-10 lg:grid lg:grid-cols-[340px_minmax(0,760px)] lg:gap-[100px] lg:px-[120px] lg:pt-[82px]">
      <div>
        <PageIntro eyebrow={`Prophecies / ${made} made`} title="Prophecies">
          Each one has a window. Morrow watches your sources and marks it the moment it lands — or when the window closes.
        </PageIntro>
        <div className="flex gap-8 pt-10">
          <Stat label="Fulfilled" value={pad2(record.fulfilled)} accent />
          <Stat label="Open" value={pad2(record.open)} />
          <Stat label="Expired" value={pad2(record.expired)} />
        </div>
        {record.marks.length > 0 && (
          <div className="flex flex-col gap-3.5 pt-7">
            <span className="label-sm text-text-muted">Record{recordSince ? ` since ${formatShortDate(recordSince)}` : ''}</span>
            <RecordMarks marks={record.marks} />
          </div>
        )}
      </div>

      <section className="mt-14 flex flex-col gap-3.5 lg:mt-0">
        <div className="flex items-center justify-between pb-0.5">
          <span className="label-sm flex items-center gap-2 text-accent">
            <span className="size-2 rounded-full bg-accent" /> Watching / {open.length} open
          </span>
          <span className="label-sm text-text-muted">Today {shortDateOf(now.toISOString(), user.timezone)}</span>
        </div>
        {open.length === 0 && (
          <p className="rounded-card border border-dashed border-hairline-strong px-5 py-6 text-text-secondary">
            Nothing open. Tomorrow&apos;s reading will bring a new prophecy.
          </p>
        )}
        {open.map((p) => (
          <ProphecyCard key={p.id} prophecy={p} now={now} timeZone={user.timezone} />
        ))}

        {resolved.length > 0 && (
          <div className="flex flex-col pt-[22px]">
            <div className="flex items-center justify-between pb-3">
              <span className="label-sm text-text-muted">Resolved / {pad2(resolved.length)}</span>
              {resolved.length > RESOLVED_PREVIEW && (
                <Link
                  href={showAll ? '/prophecies' : '/prophecies?all=1'}
                  scroll={false}
                  className="label-sm text-text-muted transition-colors hover:text-text-primary"
                >
                  {showAll ? 'Show fewer ↑' : 'See all →'}
                </Link>
              )}
            </div>
            <ol className="border-b border-hairline">
              {shown.map((p) => (
                <ResolvedRow key={p.id} prophecy={p} timeZone={user.timezone} />
              ))}
            </ol>
          </div>
        )}
      </section>
    </main>
  );
}
