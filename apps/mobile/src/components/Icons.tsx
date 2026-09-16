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
