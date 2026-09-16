import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { KeyValueList, PageIntro } from '@/components/Labels';
import { SourceRow } from '@/components/SourceRow';
import { getRepository } from '@/lib/data';
import { getSourcesView } from '@/lib/server/readings';
import { formatKb } from '@/lib/ui/format';
import { RAW_EVENT_TTL_HOURS } from '@morrow/core';

export const metadata: Metadata = { title: 'Sources' };

export default async function SourcesPage() {
  await connection();
  const repo = getRepository();
  const user = await repo.getDemoUser();
  const { sources, dossier } = await getSourcesView(repo);
  const linked = sources.filter((s) => s.status === 'linked').length;

  return (
    <main className="mx-auto w-full max-w-[1440px] px-6 pb-20 pt-10 lg:grid lg:grid-cols-[340px_minmax(0,760px)] lg:gap-[100px] lg:px-[120px] lg:pt-[142px]">
      <div>
        <PageIntro eyebrow={`Sources / ${linked} linked`} title="Sources">
          Morrow only sees what you connect. Raw events are read, distilled into your dossier, then let go.
        </PageIntro>
        <div className="pt-10 lg:w-[330px]">
          <KeyValueList
            rows={[
              { label: 'Raw events kept', value: `${RAW_EVENT_TTL_HOURS} hours` },
              { label: 'Your dossier', value: formatKb(dossier.sizeBytes) },
              { label: 'Never read', value: 'Health · Money' },
            ]}
          />
        </div>
        <div className="flex gap-6 pt-8 text-[15px] leading-6">
          <Link href="/sources/dossier" className="text-text-primary underline underline-offset-4">
            View dossier
          </Link>
          <Link href="/sources/forget" className="text-text-muted transition-colors hover:text-danger">
            Forget everything
          </Link>
        </div>
      </div>

      <section className="mt-14 lg:mt-0">
        <div className="hidden items-center pb-3 lg:grid lg:grid-cols-[40px_244px_1fr_auto] lg:gap-x-4">
          <span className="label-sm col-span-2 text-text-muted">Source</span>
          <span className="label-sm text-text-muted">What Morrow reads</span>
          <span className="label-sm text-right text-text-muted">Status</span>
        </div>
        <ul className="border-b border-hairline">
          {sources.map((s) => (
            <SourceRow key={s.kind} source={s} timeZone={user.timezone} />
          ))}
        </ul>
        <p className="pt-7 text-[15px] leading-6 text-text-muted">
          Morrow never connects anything on its own. It will ask only when a prophecy needs to see more.
        </p>
      </section>
    </main>
  );
}
