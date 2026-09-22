import Svg, { Circle, Path, Rect } from 'react-native-svg';

/** Functional UI icons only (SPEC §4.E): send, stop, back, close, menu, more, lock, check, Google "G". Paths from the v4 Paper artboards. */
type IconProps = { color: string; size?: number };

export const MenuIcon = ({ color, size = 24 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M4 8.5h16M10 15.5h10" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
  </Svg>
);

export const CloseIcon = ({ color, size = 24 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M6 6l12 12M18 6L6 18" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
  </Svg>
);

export const BackIcon = ({ color, size = 24 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M15 5l-7 7 7 7" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const MoreIcon = ({ color, size = 24 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx={5} cy={12} r={1.5} fill={color} />
    <Circle cx={12} cy={12} r={1.5} fill={color} />
    <Circle cx={19} cy={12} r={1.5} fill={color} />
  </Svg>
);

export const SendIcon = ({ color, size = 18 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 18 18">
    <Path d="M9 14.5V3.5M4.5 8L9 3.5L13.5 8" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const ArrowRightIcon = ({ color, size = 14 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 14 14">
    <Path d="M2.5 7h9M8 3.5L11.5 7 8 10.5" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const LockIcon = ({ color, size = 16 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 16 16">
    <Rect x={3} y={7} width={10} height={7} rx={1.5} fill="none" stroke={color} strokeWidth={1.3} />
    <Path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke={color} strokeWidth={1.3} strokeLinecap="round" />
  </Svg>
);

export const CheckIcon = ({ color, size = 16 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 16 16">
    <Path d="M3.5 8.5l3 3 6-7" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/** Monochrome Google "G" (sign-in button), from the v4 Sign in artboard. */
export const GoogleIcon = ({ color, size = 20 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.75-6-6.2s2.7-6.2 6-6.2c1.9 0 3.15.8 3.87 1.5l2.64-2.55C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.66 0 9.4-3.97 9.4-9.57 0-.64-.07-1.13-.16-1.63z"
      fill={color}
    />
  </Svg>
);
