import { formatLocalTime, formatShortDate, LocalDate } from '@morrow/core';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { connection } from 'next/server';
import { ChatLayout } from '@/components/chat/ChatLayout';
import { MorrowBubble, MorrowMessage } from '@/components/chat/MessageRow';
import { Composer } from '@/components/Composer';
import { Transcript, turnFromMessage } from '@/components/Transcript';
import { requirePageUser, toCoreUser } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { now } from '@/lib/server/env';
import { getReadingDetailView } from '@/lib/server/readings';
import { shortDateOf } from '@/lib/ui/format';

export async function generateMetadata({ params }: PageProps<'/readings/[date]'>): Promise<Metadata> {
  const { date } = await params;
  return { title: `Reading ${LocalDate.safeParse(date).success ? formatShortDate(date) : ''}` };
}

const Num = ({ children }: { children: string }) => <span className="font-mono text-meta">{children}</span>;

/** Sealed reading (v4 screen 10, Paper C4I-0): the day's chat, read-only. Today's open reading lives at `/`. */
export default async function SealedReadingPage({ params }: PageProps<'/readings/[date]'>) {
  await connection();
  const { date } = await params;
  if (!LocalDate.safeParse(date).success) notFound();
  const user = toCoreUser(await requirePageUser());
  const detail = await getReadingDetailView(getRepository(), user, now(), date);
  if (!detail) notFound();
  const { reading, messages, prophecies } = detail;
  if (reading.status === 'open') redirect('/');

  const tz = reading.timezone;
  const turns = messages.map((m) => turnFromMessage(m, tz));
  const sealedDate = reading.sealedAt ? shortDateOf(reading.sealedAt, tz) : null;
  const sealedTime = reading.sealedAt ? formatLocalTime(reading.sealedAt, tz) : null;

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-4 pt-8 lg:pt-10">
      <Link href="/readings" className="flex items-center gap-2 text-[14px] font-medium leading-[18px] text-accent">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
          <path d="M10 3.5 L5.5 8 L10 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Past readings
      </Link>
      <span className="label text-text-muted">
        Reading <Num>{formatShortDate(reading.localDate)}</Num>
        {sealedDate && sealedTime && (
          <>
            {' · sealed '}
            <Num>{sealedDate}</Num> at <Num>{sealedTime}</Num>
          </>
        )}
      </span>
    </div>
  );

  return (
    <ChatLayout anchor="top" header={header} composer={<Composer state="sealed" sealedHref="/" />}>
      {turns.length > 0 ? (
        <Transcript turns={turns} prophecies={prophecies} timeZone={tz} />
      ) : (
        <MorrowMessage>
          <MorrowBubble>{reading.headline}</MorrowBubble>
        </MorrowMessage>
      )}
      {sealedDate && sealedTime && (
        <div role="separator" className="flex items-center gap-4 pt-7 sm:pl-[42px]">
          <span className="h-px flex-1 bg-hairline" />
          <span className="label shrink-0 text-text-muted">
            Sealed <Num>{sealedDate}</Num> · <Num>{sealedTime}</Num>
          </span>
          <span className="h-px flex-1 bg-hairline" />
        </div>
      )}
    </ChatLayout>
  );
}
