import { formatShortDate, type Prophecy } from '@morrow/core';
import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { BodyFigure } from '@/components/BodyFigure';
import { Label, Meta, Stat, StatusDot } from '@/components/Labels';
import { ProphecyCard, ResolvedRow } from '@/components/Prophecy';
import { RecordMarks } from '@/components/RecordMarks';
import { requirePageUser, toCoreUser } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { now as serverNow } from '@/lib/server/env';
import { getProphecyListView } from '@/lib/server/readings';
import { shortDateOf } from '@/lib/ui/format';

export const metadata: Metadata = { title: 'Prophecies' };

const RESOLVED_PREVIEW = 3;

/** 11 Prophecies (Paper v4 AXO-0 / AZD-0): figure + title + counts + record left; open cards and resolved list right. */
export default async function PropheciesPage({ searchParams }: PageProps<'/prophecies'>) {
  await connection();
  const showAll = (await searchParams).all === '1';
  const repo = getRepository();
  const user = toCoreUser(await requirePageUser());
  const now = serverNow();
  const { open, resolved, record } = await getProphecyListView(repo, user);
  const all: Prophecy[] = [...open, ...resolved];
  const recordSince = [...all].sort((a, b) => a.number - b.number).slice(-record.marks.length)[0]?.madeOn;
  const shown = showAll ? resolved : resolved.slice(0, RESOLVED_PREVIEW);

  return (
    <main className="mx-auto w-full max-w-[1184px] px-6 pb-20 pt-8 lg:box-content lg:grid lg:grid-cols-[380px_minmax(0,712px)] lg:justify-between lg:gap-10 lg:px-12 lg:pt-0">
      <div className="flex flex-col">
        <div className="flex items-end justify-between gap-4 lg:block">
          <div className="lg:contents">
            <BodyFigure height={390} className="-ml-10 hidden lg:block" />
            <h1 className="font-serif text-title-m text-text lg:text-title lg:leading-[84px]">Prophecies</h1>
          </div>
          <BodyFigure height={180} className="-my-6 -mr-4 lg:hidden" />
        </div>
        <p className="max-w-[360px] pt-4 text-body-m text-text-muted lg:text-body">
          Each one has a window. Morrow keeps watch and marks it the moment it lands — or when the window closes.
        </p>
        <div className="flex gap-10 pt-8">
          <Stat label="Fulfilled" value={record.fulfilled} tone="fulfilled" />
          <Stat label="Open" value={record.open} tone="open" />
          <Stat label="Expired" value={record.expired} tone="expired" />
        </div>
        {record.marks.length > 0 && (
          <div className="flex flex-col gap-3 pt-7">
            <Label>Record{recordSince ? ` since ${formatShortDate(recordSince)}` : ''}</Label>
            <RecordMarks marks={record.marks} />
          </div>
        )}
      </div>

      <section className="mt-14 flex flex-col gap-3.5 lg:mt-0 lg:pt-[46px]" aria-label="Open prophecies">
        <div className="flex items-center justify-between pb-0.5">
          <span className="label flex items-center gap-2 text-accent">
            <StatusDot size={7} /> Watching · {open.length} open
          </span>
          <Meta>Today {shortDateOf(now.toISOString(), user.timezone)}</Meta>
        </div>
        {open.length === 0 && (
          <p className="rounded-card border border-hairline px-6 py-6 text-body-m text-text lg:text-body">
            Nothing open. Tomorrow&apos;s reading will bring a new prophecy.
          </p>
        )}
        {open.map((p) => (
          <ProphecyCard key={p.id} prophecy={p} now={now} timeZone={user.timezone} />
        ))}

        {resolved.length > 0 && (
          <div className="flex flex-col pt-12">
            <div className="flex h-9 items-center justify-between">
              <Label>Resolved · {resolved.length}</Label>
              {resolved.length > RESOLVED_PREVIEW && (
                <Link
                  href={showAll ? '/prophecies' : '/prophecies?all=1'}
                  scroll={false}
                  className="text-[14px] leading-[18px] text-accent underline-offset-4 hover:underline"
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
