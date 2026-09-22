import { useId } from 'react';

export type BallVariant = 'wordmark' | 'avatar' | 'large';
export type BallState = 'idle' | 'listening' | 'reading' | 'speaking';

type Props = {
  /** Rendered size in px (square). */
  size: number;
  /** Paint detail. Defaults from size: ≤20 wordmark, ≤40 avatar, else large. */
  variant?: BallVariant;
  /** Motion state (SPEC §4.E). Omit for a still ball. Loops respect prefers-reduced-motion. */
  state?: BallState;
  className?: string;
  /** Accessible name; the ball is decorative (aria-hidden) when omitted. */
  label?: string;
};

const STOPS = [
  ['0', '#EEF1F2'],
  ['0.14', '#E1E6E6'],
  ['0.42', '#A9C0CB'],
  ['0.72', '#7F97A3'],
  ['1', '#62798A'],
] as const;

const RIM = '#5E748273';

/**
 * Crystal ball — Morrow's mark (SPEC §4.E). Exported from Paper masters BQY-0 (wordmark 19),
 * BR3-0 (avatar 38) and BOJ-0 (large 76). viewBox 0 0 200 200; the rim stroke is scaled so it
 * renders ≈1px (0.75px at ≤32px). No glow, halo or shadow.
 */
export function CrystalBall({ size, variant, state, className = '', label }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const v: BallVariant = variant ?? (size <= 20 ? 'wordmark' : size <= 40 ? 'avatar' : 'large');
  const rimWidth = ((size <= 32 ? 0.75 : 1) * 200) / size;
  const id = (k: string) => `ball-${uid}-${k}`;
  const url = (k: string) => `url(#${id(k)})`;

  const gradients = (
    <>
      <radialGradient id={id('fill')} gradientUnits="userSpaceOnUse" cx="66" cy="63" r="134">
        {STOPS.map(([o, c]) => (
          <stop key={o} offset={o} stopColor={c} />
        ))}
      </radialGradient>
      <radialGradient id={id('edge')} gradientUnits="userSpaceOnUse" cx="100" cy="100" r="84">
        <stop offset="0.72" stopColor="#62798A" stopOpacity="0" />
        <stop offset="1" stopColor="#62798A" stopOpacity="0.5" />
      </radialGradient>
    </>
  );

  const a11y = label ? { role: 'img' as const, 'aria-label': label } : { 'aria-hidden': true as const };

  if (v === 'wordmark') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        className={`ball shrink-0 ${className}`}
        data-state={state}
        {...a11y}
      >
        <defs>{gradients}</defs>
        <circle cx="100" cy="100" r="84" fill={url('fill')} />
        <circle cx="100" cy="100" r="84" fill={url('edge')} />
        <circle cx="100" cy="100" r="84" fill="none" stroke={RIM} strokeWidth={rimWidth} />
      </svg>
    );
  }

  const large = v === 'large';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={`ball shrink-0 ${className}`}
      data-state={state}
      {...a11y}
    >
      <defs>
        {gradients}
        <filter id={id('grain')} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="11" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id={id('blur7')} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        {large && (
          <filter id={id('blur3')} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        )}
        <radialGradient id={id('deep')} gradientUnits="userSpaceOnUse" cx="100" cy="100" r="84">
          <stop offset="0.6" stopColor="#62798A" stopOpacity="0" />
          <stop offset="1" stopColor="#4E6474" stopOpacity="0.55" />
        </radialGradient>
        <clipPath id={id('clip')}>
          <circle cx="100" cy="100" r="84" />
        </clipPath>
      </defs>
      <g clipPath={url('clip')}>
        <g filter={url('grain')}>
          <circle cx="100" cy="100" r="92" fill={url('fill')} />
          <circle cx="100" cy="100" r="92" fill={url('edge')} />
        </g>
        <ellipse className="ball-core" cx="72" cy="66" rx="22" ry="15" filter={url('blur7')} fill="#FFFFFF59" />
        {large && (
          <path
            d="M173.4 119.7 A76 76 0 0 1 93.4 175.7"
            filter={url('blur3')}
            fill="none"
            stroke="#C7D6DC59"
            strokeWidth="8"
            strokeLinecap="round"
          />
        )}
        {/* Speaking: the deepest edge (shown via CSS only in that state). */}
        {state === 'speaking' && <circle className="ball-edge" cx="100" cy="100" r="84" fill={url('deep')} />}
      </g>
      <circle cx="100" cy="100" r="84" fill="none" stroke={RIM} strokeWidth={rimWidth} />
      {large && (
        <g className="ball-glints">
          <path d="M122 105 Q122 112 129 112 Q122 112 122 119 Q122 112 115 112 Q122 112 122 105Z" fill="#5A1D22" />
          <path d="M90 121 Q90 124 93 124 Q90 124 90 127 Q90 124 87 124 Q90 124 90 121Z" fill="#5A1D22" />
          <path d="M142 72 Q142 75 145 75 Q142 75 142 78 Q142 75 139 75 Q142 75 142 72Z" fill="#FFFFFFE6" />
        </g>
      )}
    </svg>
  );
}
