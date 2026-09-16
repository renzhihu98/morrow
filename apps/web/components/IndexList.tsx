'use client';

export type IndexItem = { label: string; onSelect?: () => void; disabled?: boolean };

/** Numbered index list: mono number column + label, hairline dividers. */
export function IndexList({ items, className = '' }: { items: IndexItem[]; className?: string }) {
  return (
    <ol className={`flex w-full flex-col border-b border-hairline lg:w-[420px] ${className}`}>
      {items.map((item, i) => (
        <li key={item.label} className="border-t border-hairline">
          <button
            type="button"
            onClick={item.onSelect}
            disabled={item.disabled}
            className="group flex w-full items-center gap-5 py-3.5 text-left disabled:opacity-50"
          >
            <span className="w-5 shrink-0 font-mono text-label text-text-muted">{String(i + 1).padStart(2, '0')}</span>
            <span className="text-[15px] leading-[22px] text-text-primary transition-colors group-hover:text-accent">
              {item.label}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
