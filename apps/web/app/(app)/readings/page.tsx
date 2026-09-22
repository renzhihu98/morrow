import { addDays, formatShortDate, prophecyRecord, type Prophecy, type Reading } from '@morrow/core';
import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { Label, Meta, Stat, StatusDot } from '@/components/Labels';
import { MoonGlyph } from '@/components/MoonGlyph';
import { statusWord } from '@/components/Prophecy';
import { requirePageUser, toCoreUser } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { now } from '@/lib/server/env';
import { getReadingsView } from '@/lib/server/readings';
import { weekdayShort } from '@/lib/server/time';
import { firstSentence } from '@/lib/ui/format';

export const metadata: Metadata = { title: 'Past readings' };

/** Status cell: sentence-case label + moon glyph (fulfilled full, expired new, open by likelihood). */
function ProphecyStatus({ reading, prophecy }: { reading: Reading; prophecy: Prophecy | undefined }) {
  if (reading.status === 'open') {
    return (
      <span className="flex items-center gap-2 text-[14px] font-medium leading-[18px] text-accent">
        <StatusDot /> Open now →
      </span>
    );
  }
  if (!prophecy) return <Meta>—</Meta>;
  return (
    <span className="flex items-center gap-2">
      <MoonGlyph status={prophecy.status} likelihood={prophecy.likelihood} size={16} />
      <span className={`text-[14px] leading-[18px] ${prophecy.status === 'expired' ? 'text-text-muted' : 'text-text'}`}>
        {statusWord(prophecy.status)}
      </span>
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

  const month = MONTHS[Number((readings[0]?.localDate ?? now().toISOString()).slice(5, 7)) - 1];

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 pb-20 pt-8 lg:box-content lg:grid lg:grid-cols-[360px_minmax(0,760px)] lg:justify-between lg:gap-10 lg:px-12 lg:pt-[88px]">
      <div className="flex flex-col">
        <Label>Readings · {month}</Label>
        <h1 className="pt-4 font-serif text-title-m text-text lg:pt-5 lg:text-[96px] lg:leading-[88px] lg:tracking-[-0.02em]">
          Past readings
        </h1>
        <p className="max-w-[360px] pt-5 text-body-m text-text lg:pt-7 lg:text-[17px] lg:leading-[26px]">
          One reading a day, sealed at dawn. Everything Morrow told you stays here.
        </p>
        <div className="flex gap-10 pt-8 lg:pt-10">
          <Stat label="Fulfilled" value={record.fulfilled} />
          <Stat label="Open" value={record.open} />
          <Stat label="Expired" value={record.expired} />
        </div>
      </div>

      <section className="mt-12 lg:mt-0" aria-label="Archive">
        {readings.length === 0 ? (
          <p className="border-t border-hairline pt-6 text-body-m text-text lg:text-body">No readings yet. Morrow speaks at dawn.</p>
        ) : (
          <>
            <div className="hidden h-10 items-center border-b border-hairline sm:flex">
              <span className="label w-[120px] shrink-0 text-text-muted">Date</span>
              <span className="label flex-1 text-text-muted">What Morrow saw</span>
              <span className="label w-[140px] shrink-0 text-right text-text-muted">Prophecy</span>
            </div>
            <ol>
              {readings.map((r) => {
                const isOpen = r.status === 'open';
                const prophecy = prophecies.find((p) => p.id === r.prophecyId);
                return (
                  <li key={r.id} className="border-b border-hairline first:border-t sm:first:border-t-0">
                    <Link
                      href={isOpen ? '/' : `/readings/${r.localDate}`}
                      className="group flex flex-wrap items-center gap-x-4 gap-y-2 py-4 sm:min-h-[76px] sm:flex-nowrap sm:gap-0 sm:py-3"
                    >
                      <span className="flex w-[72px] shrink-0 flex-col gap-1 sm:w-[120px]">
                        {isOpen ? (
                          <span className="text-[14px] font-medium leading-[18px] text-accent">Today</span>
                        ) : (
                          <span className="font-mono text-[13px] leading-[18px] text-text">{formatShortDate(r.localDate)}</span>
                        )}
                        <Meta>{isOpen ? `${formatShortDate(r.localDate)} ${weekdayShort(r.localDate)}` : weekdayShort(r.localDate)}</Meta>
                      </span>
                      <span className="min-w-0 flex-1 font-serif text-list-item-m text-text transition-colors group-hover:text-accent lg:text-[28px] lg:leading-[34px] lg:tracking-[-0.01em]">
                        {firstSentence(r.headline)}
                      </span>
                      <span className="flex w-full shrink-0 justify-start pl-[88px] sm:w-[140px] sm:justify-end sm:pl-0">
                        <ProphecyStatus reading={r} prophecy={prophecy} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
            {total > readings.length && earlierMonth && (
              <p className="pt-6 text-[14px] font-medium leading-[18px] text-accent">↓ Earlier readings — {earlierMonth}</p>
            )}
          </>
        )}
      </section>
    </main>
  );
}
