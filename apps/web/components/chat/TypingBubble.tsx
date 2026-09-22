/**
 * Thinking state (Asking, Paper BE5-0): a small Morrow bubble with three typing dots
 * (one Chartreuse, two Capers) and "Morrow is reading…". No source steps. Put it inside
 * `<MorrowMessage>`. The dots pulse; reduced motion leaves them still.
 */
export function TypingBubble({ label = 'Morrow is reading…', className = '' }: { label?: string; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex w-fit items-center gap-3 self-start rounded-bubble rounded-tl-bubble-tail border border-hairline bg-surface py-3.5 pl-[18px] pr-5 ${className}`}
    >
      <span className="flex items-center gap-1.5" aria-hidden>
        <span className="typing-dot size-1.5 rounded-full bg-highlight" />
        <span className="typing-dot size-1.5 rounded-full bg-text-muted opacity-70" />
        <span className="typing-dot size-1.5 rounded-full bg-text-muted opacity-40" />
      </span>
      <span className="text-[15px] leading-5 text-text-muted">{label}</span>
    </div>
  );
}
