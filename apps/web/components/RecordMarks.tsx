import type { ProphecyStatus } from '@morrow/core';

const WORD: Record<ProphecyStatus, string> = { fulfilled: 'fulfilled', expired: 'expired', open: 'open' };

/**
 * Record strip (Prophecies, Paper B4U-0): up to 12 marks — filled Oxblood dot (fulfilled),
 * Capers dash (expired), hollow Oxblood ring (open). 9px, gap 8.
 */
export function RecordMarks({ marks, className = '' }: { marks: ProphecyStatus[]; className?: string }) {
  const shown = marks.slice(-12);
  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      role="img"
      aria-label={`Record: ${shown.map((m) => WORD[m]).join(', ')}`}
    >
      {shown.map((m, i) =>
        m === 'fulfilled' ? (
          <span key={i} className="size-[9px] shrink-0 rounded-full bg-accent" />
        ) : m === 'expired' ? (
          <span key={i} className="h-px w-2.5 shrink-0 bg-text-muted" />
        ) : (
          <span key={i} className="size-[9px] shrink-0 rounded-full border border-accent" />
        ),
      )}
    </div>
  );
}
