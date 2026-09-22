import { useId } from 'react';

export type MoonStatus = 'open' | 'fulfilled' | 'expired';

type Props = {
  /** 0–1. The lit fraction tracks it (exaggerated so neighbouring values stay distinct). */
  likelihood?: number;
  /** Resolved states: fulfilled = filled full moon, expired = outline new moon. `open` uses likelihood. */
  status?: MoonStatus;
  /** px, default 20 (18 on mobile, 16 in resolved lists). */
  size?: number;
  className?: string;
  /** Override the accessible name (defaults to "Likelihood 0.71" / "Fulfilled" / "Expired"). */
  label?: string;
};

const R = 8.5;

/**
 * Likelihood → terminator k in [-1, 1] (lit fraction ≈ (1 + k) / 2).
 * Anchors are the phases drawn on Paper AXO-0 / B8E-0 (.42 → -0.494, .58 → 0.282,
 * .64 → 0.565, .71 → 0.753); piecewise-linear between them, so order is always preserved.
 */
const ANCHORS: [number, number][] = [
  [0, -1],
  [0.25, -0.76],
  [0.42, -0.494],
  [0.5, 0],
  [0.58, 0.282],
  [0.64, 0.565],
  [0.71, 0.753],
  [0.85, 0.9],
  [1, 1],
];

export function terminator(likelihood: number): number {
  const l = Math.min(1, Math.max(0, likelihood));
  for (let i = 1; i < ANCHORS.length; i++) {
    const [x1, y1] = ANCHORS[i]!;
    const [x0, y0] = ANCHORS[i - 1]!;
    if (l <= x1) return y0 + ((l - x0) / (x1 - x0)) * (y1 - y0);
  }
  return 1;
}

/** Lit region: right half-disc plus (k > 0) or minus (k < 0) a half-ellipse terminator. */
function litPath(k: number) {
  const rx = Math.abs(k) * R;
  const sweep = k >= 0 ? 1 : 0;
  return `M12 ${12 - R} A${R} ${R} 0 0 1 12 ${12 + R} A${rx.toFixed(2)} ${R} 0 0 ${sweep} 12 ${12 - R} Z`;
}

/** Moon-phase glyph — likelihood as a moon (SPEC §4.E). Oxblood 1.5px line with light grain. */
export function MoonGlyph({ likelihood, status = 'open', size = 20, className = '', label }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const filter = `moon-${uid}-grain`;
  const value = likelihood ?? 0.5;
  const name =
    label ??
    (status === 'fulfilled' ? 'Fulfilled' : status === 'expired' ? 'Expired' : `Likelihood ${value.toFixed(2)}`);
  const k = status === 'open' ? terminator(value) : 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={name}
      className={`shrink-0 text-accent ${className}`}
    >
      <defs>
        <filter id={filter} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="2" seed="2" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="0.7" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter={`url(#${filter})`}>
        <circle
          cx="12"
          cy="12"
          r={R}
          fill={status === 'fulfilled' || (status === 'open' && k >= 0.999) ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.5"
        />
        {status === 'open' && k > -0.999 && k < 0.999 && <path d={litPath(k)} fill="currentColor" />}
      </g>
    </svg>
  );
}
