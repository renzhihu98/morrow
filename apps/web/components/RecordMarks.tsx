import type { ProphecyStatus } from '@morrow/core';

/** Record marks: filled dot (fulfilled), dash (expired), hollow (open). */
export function RecordMarks({ marks }: { marks: ProphecyStatus[] }) {
  return (
    <div className="flex items-center gap-2" role="img" aria-label={marks.join(', ')}>
      {marks.map((m, i) =>
        m === 'fulfilled' ? (
          <span key={i} className="size-2.5 shrink-0 rounded-full bg-accent" />
        ) : m === 'expired' ? (
          <span key={i} className="h-0.5 w-2.5 shrink-0 bg-text-faint" />
        ) : (
          <span key={i} className="size-2.5 shrink-0 rounded-full border border-text-secondary" />
        ),
      )}
    </div>
  );
}
