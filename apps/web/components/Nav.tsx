'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ThemeToggle } from './ThemeToggle';

const ITEMS = [
  { href: '/', label: 'Today' },
  { href: '/readings', label: 'Readings' },
  { href: '/prophecies', label: 'Prophecies' },
  { href: '/sources', label: 'Sources' },
] as const;

/** Active item per SPEC §3: Today on `/`, Readings on /readings/*, etc. */
function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-9" aria-label="Main">
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`text-sm leading-5 transition-colors ${active ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary'}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Below md: a menu button that opens a full-width sheet (mirrors mobile screen 08). */
export function MobileMenu({ status }: { status: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? 'Close menu' : 'Open menu'}
        className="flex size-10 items-center justify-center"
      >
        <svg width="20" height="12" viewBox="0 0 20 12" aria-hidden>
          {open ? (
            <path d="M4 0 L16 12 M16 0 L4 12" stroke="currentColor" strokeWidth="1.4" />
          ) : (
            <path d="M0 1 H20 M6 11 H20" stroke="currentColor" strokeWidth="1.4" />
          )}
        </svg>
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full border-b border-hairline bg-bg px-6 pb-8">
          <nav className="flex flex-col" aria-label="Main">
            {ITEMS.map((item, i) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className="flex items-center gap-5 border-t border-hairline py-4"
                >
                  <span className="w-5 font-mono text-label text-text-muted">{String(i + 1).padStart(2, '0')}</span>
                  <span className={`font-serif text-list-item-m ${active ? 'text-text-primary' : 'text-text-secondary'}`}>
                    {item.label}
                  </span>
                  {active && <span className="ml-auto size-[5px] rounded-full bg-accent" />}
                </Link>
              );
            })}
          </nav>
          <div className="mt-2 flex items-center justify-between rounded-card border border-hairline bg-panel px-4 py-3">
            <span className="font-mono text-label-sm text-text-muted">{status}</span>
            <ThemeToggle />
          </div>
        </div>
      )}
    </div>
  );
}
