import Link from 'next/link';
import { isAuthEnabled, type SessionUser } from '@/lib/auth/session';
import { CrystalBall } from './CrystalBall';
import { MobileMenu, Nav } from './Nav';
import { UserMenu } from './UserMenu';

/**
 * Wordmark: 18px ball + "Morrow" in Instrument Serif 30/36 (24/30 mobile), −0.01em.
 * `size="sm"` is the 28/32 variant used on the Connect accounts header (Paper BW0-0).
 */
export function Wordmark({ href = '/', size = 'md' }: { href?: string; size?: 'md' | 'sm' }) {
  return (
    <Link href={href} className="flex items-center gap-2.5" aria-label="Morrow — today">
      <CrystalBall size={size === 'sm' ? 19 : 18} variant="wordmark" />
      <span
        className={`font-serif text-text ${
          size === 'sm' ? 'text-[28px] leading-8 tracking-[-0.01em]' : 'text-wordmark-m lg:text-wordmark'
        }`}
      >
        Morrow
      </span>
    </Link>
  );
}

/** v4 desktop nav (SPEC §4.F, Paper B9V-0): 88px, padding-inline 48, hairline bottom. No status text. */
export function TopBar({ user }: { user: SessionUser }) {
  const account = isAuthEnabled() ? <UserMenu name={user.name} image={user.image} email={user.email} /> : null;

  return (
    <header className="sticky top-0 z-20 flex h-16 bg-bg items-center justify-between border-b border-hairline px-6 lg:h-[88px] lg:px-12">
      <Wordmark />
      <div className="hidden items-center gap-9 md:flex">
        <Nav />
        {account}
      </div>
      <div className="flex items-center gap-2 md:hidden">
        {account}
        <MobileMenu />
      </div>
    </header>
  );
}
