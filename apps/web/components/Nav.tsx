'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export const NAV_ITEMS = [
  { href: '/', label: 'Today' },
  { href: '/readings', label: 'Readings' },
  { href: '/prophecies', label: 'Prophecies' },
  { href: '/sources', label: 'Sources' },
] as const;

/** Active item per SPEC §3: Today on `/`, Readings on /readings/*, etc. */
export function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop links: Geist 15/18, gap 36 — active 500 Oxblood, inactive 400 Capers. */
export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-9" aria-label="Main">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`text-[15px] leading-[18px] transition-colors ${
              active ? 'font-medium text-accent' : 'text-text-muted hover:text-text'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Below md: a menu button that opens a full-width sheet (serif items with hairlines, mobile screen 08). */
export function MobileMenu() {
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
        className="flex size-10 items-center justify-center text-text"
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
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className="flex items-center border-b border-hairline py-4"
                >
                  <span className={`font-serif text-list-item-m ${active ? 'text-accent' : 'text-text'}`}>{item.label}</span>
                  {active && <span className="ml-auto size-1.5 rounded-full bg-highlight" aria-hidden />}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
}
