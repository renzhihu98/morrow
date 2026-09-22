import { useId } from 'react';

/** Outer→inner aura bands (Chambray tone steps), right halves; mirrored for the left. */
const AURA: { fill: string; d: string }[] = [
  {
    fill: 'rgb(211 216 213)',
    d: 'M100 2 C134 2 150 30 150 62 C150 76 148 84 148 90 C170 98 184 118 188 160 C192 210 192 262 178 292 C166 318 158 346 146 360 C134 372 118 374 100 374',
  },
  {
    fill: 'rgb(200 209 210)',
    d: 'M100 11 C128 11 142 34 141 60 C141 74 138 82 136 88 C150 92 166 98 170 116 C177 150 183 200 183 236 C183 262 170 280 154 288 C148 310 146 332 138 348 C130 360 116 362 100 362',
  },
  {
    fill: 'rgb(189 202 207)',
    d: 'M100 20 C121 20 134 38 133 60 C132 72 129 80 127 86 C138 88 152 92 158 104 C164 118 167 160 172 200 C178 222 178 252 164 266 C152 274 141 270 137 282 C137 300 137 316 131 332 C128 346 122 352 100 352',
  },
  {
    fill: 'rgb(178 196 205)',
    d: 'M100 27 C116 27 128 42 127 58 C126 70 122 78 119 83 C127 86 135 87 141 91 C149 96 151 106 152 114 C155 140 160 180 165 208 C173 222 173 240 167 255 C161 264 149 265 143 257 C138 251 134 251 132 259 C130 268 129 276 129 285 C129 298 129 311 124 325 C125 335 125 345 110 346 C105 347 102 346 100 345',
  },
  {
    fill: 'rgb(169 192 203)',
    d: 'M100 35 C111 35 120 44 120 58 C120 68 115 76 112 80 C118 84 126 86 132 89 C140 93 143 102 144 111 C146 130 149 148 151 162 C154 180 157 198 158 212 C163 218 165 226 164 234 C162 244 161 254 150 256 C141 256 136 250 136 240 C135 232 135 226 135 222 C132 240 127 256 123 274 C122 290 123 304 117 320 C118 328 120 336 111 338 C106 339 102 338 100 336',
  },
];

const BODY_HALF =
  'M100 76 L105.5 76 L105.5 86 C111 90 121 91 127 94 C134 97 137 103 138 112 C141 130 143 148 146 162 C149 180 151 198 153 214 C156 218 159 224 159 230 C159 234 157 234 156 231 L155.5 245 Q154.5 248.5 153 246 L152.5 238 L151.5 249 Q150 251.5 148.5 249 L148.5 238 L147.5 247 Q146 249.5 144.5 247 L144.8 238 L143.8 243.5 Q142.3 245.5 141.2 243 C140.5 236 140 226 141 214 C139 198 136 180 133 162 C130 146 127 128 124 116 C123.5 130 117 142 115 152 C115 170 126 190 126.5 210 C126.5 232 122 252 118 272 C117 286 118 300 112 318 C111 324 114 330 110 333 L101 333 C100 326 101 318 101 304 C101 280 101 250 100 234 Z';

/** Seven chakra points, crown → root. */
const CHAKRAS: [cy: number, r: number][] = [
  [30, 3],
  [54, 2.8],
  [84, 2.8],
  [118, 3.6],
  [146, 2.8],
  [180, 2.8],
  [212, 2.8],
];

const MIRROR = 'matrix(-1 0 0 1 200 0)';
const VIEW = { x: -60, y: -70, w: 320, h: 520 };

type Props = {
  /** Rendered height in px; width follows the 320:520 aspect. */
  height: number;
  className?: string;
};

/**
 * Body figure — the one illustration (SPEC §4.E). Exported from Paper web figure AZQ-0:
 * Oxblood silhouette, five Chambray aura bands with grain-roughened edges, seven Chartreuse
 * chakra points. Decorative.
 */
export function BodyFigure({ height, className = '' }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const aura = `figure-${uid}-aura`;
  const body = `figure-${uid}-body`;
  const width = Math.round((height * VIEW.w) / VIEW.h);
  return (
    <svg
      aria-hidden
      width={width}
      height={height}
      viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
      className={`shrink-0 ${className}`}
    >
      <defs>
        <filter id={aura} filterUnits="userSpaceOnUse" x={VIEW.x} y={VIEW.y} width={VIEW.w} height={VIEW.h}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id={body} filterUnits="userSpaceOnUse" x={VIEW.x} y={VIEW.y} width={VIEW.w} height={VIEW.h}>
          <feTurbulence type="fractalNoise" baseFrequency="1" numOctaves="2" seed="8" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter={`url(#${aura})`}>
        {AURA.map((band) => (
          <g key={band.fill} fill={band.fill}>
            <path d={band.d} />
            <path transform={MIRROR} d={band.d} />
          </g>
        ))}
      </g>
      <g filter={`url(#${body})`} fill="var(--color-accent)">
        <ellipse cx="100" cy="58" rx="14" ry="18" />
        <path d={BODY_HALF} />
        <path transform={MIRROR} d={BODY_HALF} />
      </g>
      <g fill="var(--color-highlight)">
        {CHAKRAS.map(([cy, r]) => (
          <circle key={cy} cx="100" cy={cy} r={r} />
        ))}
      </g>
    </svg>
  );
}
