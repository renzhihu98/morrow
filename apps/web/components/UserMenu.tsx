'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { authClient } from '@/lib/auth/client';

type Props = { name: string; image: string | null; email?: string };

/** Top-bar avatar (initial in a hairline circle, per screen 14) with a sign-out menu. */
export function UserMenu({ name, image, email }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const signOut = async () => {
    setBusy(true);
    await authClient.signOut().catch(() => null);
    router.replace('/sign-in');
    router.refresh();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account — ${name}`}
        className="flex size-[30px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-hairline-strong font-serif text-[15px] leading-[18px] text-text-primary transition-colors hover:border-text-muted"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- provider avatar, tiny, external host
          <img src={image} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
        ) : (
          (name.trim()[0] ?? '·').toUpperCase()
        )}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-[calc(100%+10px)] z-30 w-[220px] rounded-card border border-hairline bg-panel p-1.5">
          <div className="flex flex-col gap-1 px-3 pb-2.5 pt-2">
            <span className="label-sm text-text-muted">Signed in as</span>
            <span className="truncate text-sm text-text-primary">{email ?? name}</span>
          </div>
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={signOut}
            className="w-full rounded-[8px] border-t border-hairline px-3 py-2.5 text-left text-sm text-text-secondary transition-colors hover:bg-subtle hover:text-text-primary disabled:opacity-60"
          >
            {busy ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  );
}
