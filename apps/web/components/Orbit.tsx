export type OrbitState = 'idle' | 'reading' | 'fulfilled' | 'sealed';

export type OrbitNode = {
  /** Mono label, e.g. "CALENDAR". */
  label?: string;
  /** Accent node (the pattern / fulfilled contact). */
  accent?: boolean;
};

type Props = {
  state?: OrbitState;
  /** Rendered width in px, or a CSS length (defaults to fluid 100%). */
  size?: number | string;
  /** Up to three nodes: [calendar (lower-left), spotify (upper-right), focus (lower-right, accent)]. */
  nodes?: [OrbitNode?, OrbitNode?, OrbitNode?];
  showLabels?: boolean;
  className?: string;
};

// Geometry from the Paper artboards (viewBox 660).
const NODE_POS = [
  { cx: 63, cy: 450, lx: 26, ly: 468 },
  { cx: 538, cy: 200, lx: 508, ly: 170 },
  { cx: 512, cy: 480, lx: 474, ly: 498 },
] as const;

const accentAlpha = (a: number) => `color-mix(in srgb, var(--color-accent) ${a}%, transparent)`;

/** The line-drawn orbit diagram that stands in for Morrow (SPEC §4.4). */
export function Orbit({ state = 'idle', size, nodes, showLabels = false, className = '' }: Props) {
  const fulfilled = state === 'fulfilled';
  const reading = state === 'reading';
  const sealed = state === 'sealed';
  const resolvedNodes = nodes ?? [{ label: 'CALENDAR' }, { label: 'SPOTIFY' }, { accent: true }];
  const width = typeof size === 'number' ? `${size}px` : (size ?? '100%');

  return (
    <div
      className={`relative aspect-square ${className}`}
      style={{ width, opacity: sealed ? 0.55 : 1 }}
      role="img"
      aria-label={`Morrow orbit — ${state}`}
    >
      <svg viewBox="0 0 660 660" className="absolute inset-0 size-full overflow-visible" aria-hidden>
        <circle cx="330" cy="330" r="260" fill="none" stroke="var(--color-orbit-faint)" />
        <g className={reading ? 'origin-center animate-spin-slow' : undefined} style={{ transformBox: 'view-box' }}>
          <circle
            cx="330"
            cy="330"
            r="170"
            fill="none"
            stroke={reading ? accentAlpha(50) : 'var(--color-hairline)'}
            strokeDasharray="2 6"
          />
        </g>
        <ellipse cx="330" cy="330" rx="310" ry="92" transform="rotate(-18 330 330)" fill="none" stroke="var(--color-orbit-line)" />
        <ellipse
          cx="330"
          cy="330"
          rx="250"
          ry="64"
          transform="rotate(34 330 330)"
          fill="none"
          stroke={fulfilled ? accentAlpha(55) : 'var(--color-hairline)'}
        />
        <path d="M330 44 V62 M330 598 V616 M44 330 H62 M598 330 H616" fill="none" stroke="var(--color-tick)" />
        <circle cx="330" cy="330" r="58" fill="var(--color-core)" stroke={fulfilled ? accentAlpha(60) : 'var(--color-tick)'} />
        {!sealed && (
          <circle
            cx="330"
            cy="330"
            r={reading ? 40 : fulfilled ? 34 : 22}
            fill="var(--color-accent)"
            fillOpacity={reading ? 0.16 : fulfilled ? 0.14 : 0.08}
            className="animate-breathe"
            style={{ transformOrigin: '330px 330px', transformBox: 'view-box' }}
          />
        )}
        <circle cx="330" cy="330" r={fulfilled ? 6 : 4} fill={sealed ? 'var(--color-text-muted)' : 'var(--color-accent)'} />
        {resolvedNodes.map((node, i) => {
          const pos = NODE_POS[i];
          if (!node || !pos) return null;
          const accent = node.accent && !sealed;
          return (
            <circle
              key={i}
              cx={pos.cx}
              cy={pos.cy}
              r={accent && fulfilled ? 5 : 3.5}
              fill={accent ? 'var(--color-accent)' : node.accent ? 'var(--color-text-muted)' : 'var(--color-text-secondary)'}
            />
          );
        })}
      </svg>
      {showLabels &&
        resolvedNodes.map((node, i) => {
          const pos = NODE_POS[i];
          if (!node?.label || !pos) return null;
          return (
            <span
              key={i}
              className={`absolute whitespace-nowrap font-mono text-label-sm tracking-[0.04em] ${node.accent && !sealed ? 'text-accent' : 'text-text-muted'}`}
              style={{ left: `${(pos.lx / 660) * 100}%`, top: `${(pos.ly / 660) * 100}%` }}
            >
              {node.label}
            </span>
          );
        })}
    </div>
  );
}

/** Tiny dashed, fading orbit for the Forget screen. */
export function FadingOrbit({ size = 110 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 110 110" aria-hidden className="opacity-80">
      <circle cx="55" cy="55" r="48" fill="none" stroke="var(--color-hairline-strong)" strokeDasharray="2 4" />
      <ellipse cx="55" cy="55" rx="52" ry="16" transform="rotate(-18 55 55)" fill="none" stroke="var(--color-hairline)" strokeDasharray="2 4" />
      <circle cx="55" cy="55" r="11" fill="none" stroke="var(--color-tick)" />
      <circle cx="55" cy="55" r="2" fill="var(--color-text-muted)" />
      <circle cx="105" cy="16" r="2" fill="var(--color-text-faint)" />
      <circle cx="6" cy="88" r="2" fill="var(--color-text-faint)" />
    </svg>
  );
}
