import { grain } from '@morrow/tokens';

/**
 * Paper grain (SPEC §4.C): one full-bleed overlay, the top layer of every screen.
 * Mounted once in the root layout. Fixed, pointer-events none, multiply at 8%.
 */
export function Grain() {
  return (
    <svg
      aria-hidden
      width="100%"
      height="100%"
      className="pointer-events-none fixed inset-0 z-[100] size-full"
      style={{ mixBlendMode: grain.blend, opacity: grain.opacity }}
    >
      <filter id="morrow-grain">
        <feTurbulence type="fractalNoise" baseFrequency={grain.baseFrequency} numOctaves={grain.numOctaves} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#morrow-grain)" fill="#000" />
    </svg>
  );
}
