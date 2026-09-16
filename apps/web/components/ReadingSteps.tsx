import type { StepData } from '@/lib/chat-types';

const GLYPH = { done: '✓', active: '◌', pending: '·' } as const;

/** "Morrow is reading…" — left-bordered step list (screen 06). */
export function ReadingSteps({ steps, reading = true }: { steps: StepData[]; reading?: boolean }) {
  return (
    <div className="flex flex-col gap-[18px]" aria-live="polite">
      <div className="flex items-center gap-2.5">
        <span className="size-[5px] shrink-0 rounded-full bg-accent" />
        <span className="label text-accent">{reading ? 'Morrow is reading' : 'Morrow read'}</span>
        {reading && (
          <span className="flex items-center gap-1" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-1 rounded-full bg-accent animate-pulse-dot"
                style={{ animationDelay: `${i * 180}ms` }}
              />
            ))}
          </span>
        )}
      </div>
      {steps.length > 0 && (
        <ol className="flex flex-col gap-3.5 border-l border-hairline pl-5">
          {steps.map((s) => {
            const tone =
              s.status === 'active' ? 'text-accent' : s.status === 'done' ? 'text-text-secondary' : 'text-text-faint';
            return (
              <li key={s.id} className="flex items-start gap-3.5 sm:items-center">
                <span
                  className={`w-4 shrink-0 font-mono text-label ${s.status === 'done' ? 'text-text-muted' : tone} ${
                    s.status === 'active' ? 'animate-breathe' : ''
                  }`}
                  aria-label={s.status}
                >
                  {GLYPH[s.status]}
                </span>
                <span className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3.5">
                  <span className={`label w-[120px] shrink-0 ${tone}`}>{s.label}</span>
                  <span
                    className={`text-[15px] leading-[22px] ${
                      s.status === 'active' ? 'text-text-primary' : s.status === 'done' ? 'text-text-secondary' : 'text-text-faint'
                    }`}
                  >
                    {s.status === 'pending' ? 'Waiting' : s.detail}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
