import Svg, { Path, Rect } from 'react-native-svg';

type IconProps = { color: string; size?: number };

export const MenuIcon = ({ color, size = 22 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22">
    <Path d="M3 8 H19 M3 14 H13" fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
  </Svg>
);

export const CloseIcon = ({ color, size = 22 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22">
    <Path d="M6 6 L16 16 M16 6 L6 16" fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
  </Svg>
);

export const SendIcon = ({ color, size = 16 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 16 16">
    <Path
      d="M8 13 V3 M3.5 7.5 L8 3 L12.5 7.5"
      fill="none"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const ArrowRightIcon = ({ color, size = 12 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 12 12">
    <Path d="M2 6 H10 M6.5 2.5 L10 6 L6.5 9.5" fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const LockIcon = ({ color, size = 14 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 14 14">
    <Rect x={2.5} y={6} width={9} height={6.5} rx={1.5} fill="none" stroke={color} strokeWidth={1.2} />
    <Path d="M4.5 6 V4.5 a2.5 2.5 0 0 1 5 0 V6" fill="none" stroke={color} strokeWidth={1.2} />
  </Svg>
);

/** Monochrome Google "G" (sign-in button, SPEC §12.1). */
export const GoogleIcon = ({ color, size = 18 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 18 18">
    <Path d="M16.5 9.2c0-.6-.05-1.1-.15-1.6H9v3.1h4.2a3.6 3.6 0 0 1-1.55 2.35v1.95h2.5c1.47-1.35 2.35-3.35 2.35-5.8Z" fill={color} />
    <Path d="M9 17c2.1 0 3.85-.7 5.15-1.9l-2.5-1.95c-.7.47-1.6.75-2.65.75-2.03 0-3.76-1.37-4.37-3.22H2.05v2A8 8 0 0 0 9 17Z" fill={color} />
    <Path d="M4.63 10.68a4.8 4.8 0 0 1 0-3.36v-2H2.05a8 8 0 0 0 0 7.36l2.58-2Z" fill={color} />
    <Path d="M9 4.4c1.15 0 2.18.4 3 1.17l2.22-2.22A8 8 0 0 0 2.05 5.32l2.58 2C5.24 5.77 6.97 4.4 9 4.4Z" fill={color} />
  </Svg>
);
