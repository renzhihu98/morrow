import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';

export type MoonStatus = 'open' | 'fulfilled' | 'expired';

type Props = {
  /** 0–1. The lit fraction tracks it (waxing, lit on the right). Used when status is `open` or omitted. */
  likelihood?: number;
  /** `fulfilled` = filled full moon, `expired` = outline new moon. Default `open`. */
  status?: MoonStatus;
  /** pt. Default 18 (SPEC §4.E mobile); resolved-list rows use 12. */
  size?: number;
  /** Defaults to accent (Oxblood). */
  color?: string;
  /** Override the default label ("Likelihood 0.71", "Fulfilled", "Expired"). */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const R = 6.5;
const C = 8;

/**
 * Terminator half-width in viewBox units (0 = half moon, R = new/full).
 * Linear in (2l − 1), which is what the Paper glyphs use (.58 → 1.0, .64 → 1.8, .71 → 2.7):
 * at 18pt neighbouring hundredths stay visibly distinct and the order is always correct.
 */
export const terminatorRx = (l: number) => Math.max(0.01, R * Math.abs(2 * l - 1));

/** Filled lit region for likelihood l (0 < l < 1). */
export function moonPath(l: number): string {
  const rx = terminatorRx(l).toFixed(2);
  // Right limb top → bottom, then back up along the terminator: via the left for gibbous, the right for crescent.
  const sweep = l >= 0.5 ? 1 : 0;
  return `M${C} ${C - R} A${R} ${R} 0 0 1 ${C} ${C + R} A${rx} ${R} 0 0 ${sweep} ${C} ${C - R} Z`;
}

/** Likelihood as a moon phase (SPEC §4.E): Oxblood line, exaggerated but ordered phases. */
export function MoonGlyph({ likelihood, status = 'open', size = 18, color, accessibilityLabel, style }: Props) {
  const { palette } = useTheme();
  const ink = color ?? palette.accent;
  const l = likelihood === undefined ? 0.5 : Math.min(1, Math.max(0, likelihood));
  const full = status === 'fulfilled' || (status === 'open' && l >= 0.97);
  const empty = status === 'expired' || (status === 'open' && l <= 0.03);
  const label =
    accessibilityLabel ??
    (status === 'fulfilled' ? 'Fulfilled' : status === 'expired' ? 'Expired' : likelihood === undefined ? 'Open' : `Likelihood ${l.toFixed(2)}`);

  return (
    <View style={[{ width: size, height: size }, style]} accessible accessibilityRole="image" accessibilityLabel={label}>
      <Svg width={size} height={size} viewBox="0 0 16 16">
        <Circle cx={C} cy={C} r={R} fill={full ? ink : 'none'} stroke={ink} strokeWidth={1.2} />
        {!full && !empty && <Path d={moonPath(l)} fill={ink} />}
      </Svg>
    </View>
  );
}
