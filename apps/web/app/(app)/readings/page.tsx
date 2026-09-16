import { addDays, formatProphecyNumber, formatShortDate, prophecyRecord, type Prophecy, type Reading } from '@morrow/core';
import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { PageIntro, Stat } from '@/components/Labels';
import { requirePageUser, toCoreUser } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { now } from '@/lib/server/env';
import { getReadingsView } from '@/lib/server/readings';
import { weekdayShort } from '@/lib/server/time';
import { firstSentence, pad2 } from '@/lib/ui/format';

export const metadata: Metadata = { title: 'Past readings' };

function ProphecyStatus({ reading, prophecy }: { reading: Reading; prophecy: Prophecy | undefined }) {
  if (reading.status === 'open') {
    return (
      <span className="label-sm flex items-center gap-2 text-accent">
        <span className="size-1.5 rounded-full bg-accent" /> Open now →
      </span>
    );
  }
  if (!prophecy) return <span className="label-sm text-text-faint">—</span>;
  const n = formatProphecyNumber(prophecy.number);
  if (prophecy.status === 'fulfilled')
    return (
      <span className="label-sm flex items-center gap-2 text-accent">
        <span className="size-1.5 rounded-full bg-accent" /> {n} fulfilled
      </span>
    );
  if (prophecy.status === 'expired')
    return (
      <span className="label-sm flex items-center gap-2 text-text-muted">
        <span className="h-px w-1.5 bg-text-muted" /> {n} expired
      </span>
    );
  return (
    <span className="label-sm flex items-center gap-2 text-text-secondary">
      <span className="size-1.5 rounded-full border border-text-secondary" /> {n} open
    </span>
  );
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default async function ReadingsPage() {
  await connection();
  const user = toCoreUser(await requirePageUser());
  const repo = getRepository();
  const { readings, total } = await getReadingsView(repo, user, now());
  const prophecies = await repo.listProphecies(user.id);
  const record = prophecyRecord(prophecies);
  const oldest = readings.at(-1);
  const earlierMonth = oldest ? MONTHS[Number(addDays(oldest.localDate, -1).slice(5, 7)) - 1] : null;

  return (
    <main className="mx-auto w-full max-w-[1440px] px-6 pb-20 pt-10 lg:grid lg:grid-cols-[340px_minmax(0,760px)] lg:gap-[100px] lg:px-[120px] lg:pt-[124px]">
      <div>
        <PageIntro eyebrow={`Archive / ${total} ${total === 1 ? 'reading' : 'readings'}`} title="Past readings">
          One reading a day, sealed at dawn. Everything Morrow told you stays here.
        </PageIntro>
        <div className="flex gap-8 pt-10">
          <Stat label="Fulfilled" value={pad2(record.fulfilled)} accent />
          <Stat label="Open" value={pad2(record.open)} />
          <Stat label="Expired" value={pad2(record.expired)} />
        </div>
      </div>

      <section className="mt-14 lg:mt-0">
        {readings.length === 0 ? (
          <p className="border-t border-hairline pt-6 text-text-secondary">No readings yet. Morrow speaks at dawn.</p>
        ) : (
          <>
            <div className="hidden items-center pb-3 sm:flex">
              <span className="label-sm w-[120px] shrink-0 text-text-muted">Date</span>
              <span className="label-sm flex-1 text-text-muted">What Morrow saw</span>
              <span className="label-sm w-[170px] shrink-0 text-right text-text-muted">Prophecy</span>
            </div>
            <ol className="border-b border-hairline">
              {readings.map((r) => {
                const isOpen = r.status === 'open';
                const prophecy = prophecies.find((p) => p.id === r.prophecyId);
                return (
                  <li key={r.id} className="border-t border-hairline">
                    <Link
                      href={isOpen ? '/' : `/readings/${r.localDate}`}
                      className="group flex flex-wrap items-center gap-y-2 py-[17px] sm:flex-nowrap"
                    >
                      <span className="flex w-[96px] shrink-0 flex-col gap-[3px] sm:w-[120px]">
                        <span className={`font-mono text-[13px] leading-4 ${isOpen ? 'text-accent' : 'text-text-primary'}`}>
                          {isOpen ? 'TODAY' : formatShortDate(r.localDate)}
                        </span>
                        <span className="font-mono text-label-sm text-text-muted">
                          {isOpen ? `${formatShortDate(r.localDate)} ${weekdayShort(r.localDate)}` : weekdayShort(r.localDate)}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1 basis-[60%] font-serif text-list-item-m transition-colors group-hover:text-accent sm:basis-auto lg:text-list-item">
                        {firstSentence(r.headline)}
                      </span>
                      <span className="flex w-full shrink-0 justify-start pl-[96px] sm:w-[170px] sm:justify-end sm:pl-0">
                        <ProphecyStatus reading={r} prophecy={prophecy} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
            {total > readings.length && earlierMonth && (
              <p className="label-sm pt-6 text-text-muted">↓ Earlier readings — {earlierMonth}</p>
            )}
          </>
        )}
      </section>
    </main>
  );
}
