import Link from 'next/link';
import type { ReactNode } from 'react';
import { Wordmark } from '@/components/TopBar';
import { LEGAL } from '@/lib/legal';

/** Public legal document frame (Privacy, Terms): wordmark header, serif title, readable 680 column. */
export function LegalPage({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  const [y, m, d] = LEGAL.updated.split('-');
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1088px] flex-col px-6 lg:box-content lg:px-12">
      <header className="flex h-16 items-center justify-between lg:h-24">
        <Wordmark size="sm" href="/sign-in" />
        <nav className="flex gap-6 text-[14px] leading-[18px]">
          <Link href="/privacy" className="text-accent hover:underline">
            Privacy
          </Link>
          <Link href="/terms" className="text-accent hover:underline">
            Terms
          </Link>
        </nav>
      </header>
      <main className="w-full max-w-[680px] pb-24 pt-8 lg:pt-16">
        <h1 className="font-serif text-title-m text-text lg:text-title">{title}</h1>
        <p className="pt-4 text-[14px] leading-5 text-text-muted">
          Last updated{' '}
          <span className="font-mono text-meta">
            {d}.{m}.{y}
          </span>
        </p>
        <div className="pt-8 text-body-lg-m text-text lg:text-body-lg">{intro}</div>
        <div className="flex flex-col gap-10 pt-12">{children}</div>
      </main>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-hairline pt-6">
      <h2 className="font-serif text-list-item-m text-text lg:text-list-item">{title}</h2>
      <div className="flex flex-col gap-3 text-body-m text-text lg:text-body [&_a]:text-accent [&_a]:underline [&_li]:pl-1 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
