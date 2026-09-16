import { formatLocalTime } from '@morrow/core';
import Link from 'next/link';
import { isAuthEnabled, toCoreUser, type SessionUser } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { now } from '@/lib/server/env';
import { MobileMenu, Nav } from './Nav';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

export function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-3" aria-label="Morrow — today">
      <span className="size-[7px] shrink-0 rounded-full bg-accent" />
      <span className="font-serif text-[28px] leading-8">Morrow</span>
    </Link>
  );
}

export async function TopBar({ user }: { user: SessionUser }) {
  const core = toCoreUser(user);
  const linked = (await getRepository().listSources(core.id)).filter((s) => s.status === 'linked').length;
  const status = `${formatLocalTime(now(), core.timezone)} — ${linked} ${linked === 1 ? 'source' : 'sources'} linked`;
  const account = isAuthEnabled() ? <UserMenu name={user.name} image={user.image} email={user.email} /> : null;

  return (
    <header className="relative z-20 flex items-center justify-between px-6 py-5 lg:px-12 lg:py-7">
      <Wordmark />
      <div className="hidden items-center gap-9 md:flex">
        <Nav />
        <span className="h-4 w-px shrink-0 bg-hairline" />
        <span className="font-mono text-label text-text-muted">{status}</span>
        <ThemeToggle />
        {account}
      </div>
      <div className="flex items-center gap-2 md:hidden">
        {account}
        <MobileMenu status={status} />
      </div>
    </header>
  );
}
