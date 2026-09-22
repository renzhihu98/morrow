/** Day divider: sentence-case Geist 13 label between two hairlines (`Monday · September 21`). */
export function DayDivider({ label, className = '' }: { label: string; className?: string }) {
  return (
    <div role="separator" aria-label={label} className={`flex items-center gap-4 pb-2 ${className}`}>
      <span className="h-px flex-1 bg-hairline" />
      <span className="label shrink-0 text-text-muted">{label}</span>
      <span className="h-px flex-1 bg-hairline" />
    </div>
  );
}
