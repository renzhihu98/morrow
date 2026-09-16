import { formatLocalTime } from '@morrow/core';
import Link from 'next/link';
import { getRepository } from '@/lib/data';
import { now } from '@/lib/server/env';
import { MobileMenu, Nav } from './Nav';
import { ThemeToggle } from './ThemeToggle';

export async function TopBar() {
  const repo = getRepository();
  const user = await repo.getDemoUser();
  const linked = (await repo.listSources(user.id)).filter((s) => s.status === 'linked').length;
  const status = `${formatLocalTime(now(), user.timezone)} — ${linked} ${linked === 1 ? 'source' : 'sources'} linked`;

  return (
    <header className="relative z-20 flex items-center justify-between px-6 py-5 lg:px-12 lg:py-7">
      <Link href="/" className="flex items-center gap-3" aria-label="Morrow — today">
        <span className="size-[7px] shrink-0 rounded-full bg-accent" />
        <span className="font-serif text-[28px] leading-8">Morrow</span>
      </Link>
      <div className="hidden items-center gap-9 md:flex">
        <Nav />
        <span className="h-4 w-px shrink-0 bg-hairline" />
        <span className="font-mono text-label text-text-muted">{status}</span>
        <ThemeToggle />
      </div>
      <MobileMenu status={status} />
    </header>
  );
}
