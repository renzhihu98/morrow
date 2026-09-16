import { formatLocalTime, formatShortDate, LocalDate } from '@morrow/core';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Composer } from '@/components/Composer';
import { Orbit } from '@/components/Orbit';
import { Transcript, turnFromMessage } from '@/components/Transcript';
import { getRepository } from '@/lib/data';
import { now } from '@/lib/server/env';
import { getReadingDetailView } from '@/lib/server/readings';
import { shortDateOf } from '@/lib/ui/format';

export async function generateMetadata({ params }: PageProps<'/readings/[date]'>): Promise<Metadata> {
  const { date } = await params;
  return { title: `Reading ${LocalDate.safeParse(date).success ? formatShortDate(date) : ''}` };
}

/** Sealed reading (screen 05). Today's open reading lives at `/`. */
export default async function SealedReadingPage({ params }: PageProps<'/readings/[date]'>) {
  await connection();
  const { date } = await params;
  if (!LocalDate.safeParse(date).success) notFound();
  const detail = await getReadingDetailView(getRepository(), now(), date);
  if (!detail) notFound();
  const { reading, messages, prophecies } = detail;
  if (reading.status === 'open') redirect('/');

  const tz = reading.timezone;
  const sealed = reading.sealedAt ? `${shortDateOf(reading.sealedAt, tz)} ${formatLocalTime(reading.sealedAt, tz)}` : '';
  const turns = messages.map((m) => turnFromMessage(m, tz));

  return (
    <main className="relative mx-auto flex min-h-[calc(100dvh-88px)] w-full max-w-[1440px] flex-col px-6 lg:px-[120px]">
      <div className="pointer-events-none mx-auto mt-2 flex w-[180px] flex-col items-center gap-6 lg:absolute lg:right-[100px] lg:top-[122px] lg:mt-0 lg:w-[440px]">
        <Orbit state="sealed" />
        {reading.sealedAt && (
          <div className="hidden items-center gap-2.5 lg:flex">
            <span className="size-[5px] rounded-full bg-text-muted" />
            <span className="label-sm text-text-muted">
              Sealed {shortDateOf(reading.sealedAt, tz)} · {formatLocalTime(reading.sealedAt, tz)}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-9 pb-10 pt-8 lg:w-[680px] lg:pt-[62px]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-5">
          <Link href="/readings" className="label text-text-secondary transition-colors hover:text-text-primary">
            ← Past readings
          </Link>
          <span className="label text-text-muted">
            Reading {formatShortDate(reading.localDate)}
            {sealed && ` · Sealed ${sealed}`}
          </span>
        </div>
        {turns.length > 0 ? (
          <Transcript turns={turns} prophecies={prophecies} timeZone={tz} />
        ) : (
          <p className="text-text-secondary">{reading.headline}</p>
        )}
      </div>

      <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-bg from-60% to-transparent px-4 pb-[30px] pt-6 lg:mx-0 lg:px-0 lg:pb-10">
        <Composer state="sealed" />
      </div>
    </main>
  );
}
