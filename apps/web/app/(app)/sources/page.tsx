import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { buttonClass } from '@/components/ui/Button';
import { SourceRow } from '@/components/SourceRow';
import { requirePageUser, toCoreUser } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { getSourcesView } from '@/lib/server/readings';
import { formatKb } from '@/lib/ui/format';
import { RAW_EVENT_TTL_HOURS } from '@morrow/core';

export const metadata: Metadata = { title: 'Sources' };

export default async function SourcesPage() {
  await connection();
  const repo = getRepository();
  const user = toCoreUser(await requirePageUser());
  const { sources, dossier } = await getSourcesView(repo, user);

  return (
    <main className="mx-auto w-full max-w-[1184px] px-6 pb-20 pt-8 lg:box-content lg:grid lg:grid-cols-[380px_minmax(0,712px)] lg:justify-between lg:gap-10 lg:px-12 lg:pt-[120px]">
      <div className="flex flex-col">
        <h1 className="font-serif text-title-m text-text lg:text-title lg:leading-[84px]">Sources</h1>
        <p className="max-w-[360px] pt-4 text-body-m text-text-muted lg:text-body">
          Morrow only sees what you connect. Raw events are read, distilled into your dossier, then let go.
        </p>
        <dl className="flex flex-col pt-9 lg:w-[340px]">
          {[
            { label: 'Raw events kept', value: `${RAW_EVENT_TTL_HOURS} hours` },
            { label: 'Your dossier', value: formatKb(dossier.sizeBytes) },
            { label: 'Never read', value: 'Health · money' },
          ].map((r) => (
            <div key={r.label} className="flex h-11 items-center justify-between gap-4 border-b border-hairline">
              <dt className="label text-text-muted">{r.label}</dt>
              <dd className="text-[15px] leading-5 text-text">{r.value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex items-center gap-7 pt-6">
          <Link href="/sources/dossier" className="text-[15px] font-medium leading-5 text-accent underline decoration-1 underline-offset-4">
            View dossier
          </Link>
          <Link href="/sources/forget" className={buttonClass('danger-link')}>
            Forget everything
          </Link>
        </div>
      </div>

      <section className="mt-12 lg:mt-0" aria-label="Connected sources">
        <div className="hidden h-9 items-center border-b border-hairline lg:grid lg:grid-cols-[264px_1fr_116px]">
          <span className="label text-text-muted">Source</span>
          <span className="label text-text-muted">What Morrow reads</span>
          <span className="label text-right text-text-muted">Status</span>
        </div>
        <ul className="border-t border-hairline lg:border-t-0">
          {sources.map((s) => (
            <SourceRow key={s.kind} source={s} timeZone={user.timezone} />
          ))}
        </ul>
        <p className="pt-5 text-[15px] leading-[22px] text-text-muted">
          Morrow never connects anything on its own. It will ask only when a prophecy needs to see more.
        </p>
      </section>
    </main>
  );
}
