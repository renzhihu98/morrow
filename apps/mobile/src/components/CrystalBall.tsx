import { useEffect, useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, RadialGradient, Stop } from 'react-native-svg';

export type CrystalBallState = 'idle' | 'listening' | 'reading' | 'speaking';
/** `mark` = wordmark (fill + rim only), `avatar` = chat avatar, `large` = greeting ball with glints. */
export type CrystalBallVariant = 'mark' | 'avatar' | 'large';

type Props = {
  /** Rendered diameter in pt (the SVG box; the globe itself is 84% of it, as in the Paper masters). */
  size: number;
  /** Defaults by size: ≤20 → mark, ≤48 → avatar, else large. */
  variant?: CrystalBallVariant;
  /** Motion state (SPEC §4.E). Omit for the still master. */
  state?: CrystalBallState;
  style?: StyleProp<ViewStyle>;
  /** Screen-reader label; the ball is decorative when omitted. */
  accessibilityLabel?: string;
};

type Paint = {
  stops: readonly [string, number][];
  edge: string;
  edgeFrom: number;
  edgeOpacity: number;
  highlight: { cx: number; cy: number; rx: number; ry: number; sigma: number; opacity: number };
  reflex: number;
  rimOpacity: number;
  /** Veil of the paper ground over the globe: stands in for the web's `contrast(90%)` on idle. */
  veil: number;
  whiteGlint: boolean;
};

const STOPS_MASTER: Paint['stops'] = [
  ['#EEF1F2', 0],
  ['#E1E6E6', 0.14],
  ['#A9C0CB', 0.42],
  ['#7F97A3', 0.72],
  ['#62798A', 1],
];

// Values from the Paper masters BQY/BR3/BOJ and motion states BTT/BUB/BV3/BVO.
const MASTER: Paint = {
  stops: STOPS_MASTER,
  edge: '#62798A',
  edgeFrom: 0.72,
  edgeOpacity: 0.5,
  highlight: { cx: 72, cy: 66, rx: 22, ry: 15, sigma: 7, opacity: 0.35 },
  reflex: 0.35,
  rimOpacity: 0.45,
  veil: 0,
  whiteGlint: true,
};

const PAINT: Record<CrystalBallState, Paint> = {
  idle: { ...MASTER, highlight: { ...MASTER.highlight, opacity: 0.3 }, reflex: 0.3, veil: 0.1, whiteGlint: false },
  listening: {
    ...MASTER,
    stops: [
      ['#F4F6F6', 0],
      ['#E5E9E8', 0.2],
      ['#A9C0CB', 0.48],
      ['#7F97A3', 0.76],
      ['#62798A', 1],
    ],
    highlight: { cx: 74, cy: 68, rx: 28, ry: 19, sigma: 8, opacity: 0.45 },
    whiteGlint: false,
  },
  reading: MASTER,
  speaking: {
    ...MASTER,
    stops: [
      ['#F6F8F8', 0],
      ['#E3E8E8', 0.13],
      ['#A9C0CB', 0.4],
      ['#7890A0', 0.7],
      ['#586F80', 1],
    ],
    edge: '#586F80',
    edgeFrom: 0.7,
    edgeOpacity: 0.55,
    highlight: { ...MASTER.highlight, opacity: 0.45 },
    reflex: 0.4,
    rimOpacity: 0.5,
  },
};

const RIM = '#5E7482';
const OXBLOOD = '#5A1D22';
const PARCEL = '#E5E3DA';
const star = (x: number, y: number, r: number) =>
  `M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r}Z`;

/**
 * Morrow's mark (SPEC §4.E), ported from the Paper masters (viewBox 200, globe r=84).
 * react-native-svg can't run the grain displacement or Gaussian blur, so the displacement is
 * dropped and the blurred highlight becomes an ellipse whose radial gradient fades to clear.
 * The closing rim always renders ≈1px (0.75px at ≤32px).
 */
export function CrystalBall({ size, variant, state, style, accessibilityLabel }: Props) {
  const kind: CrystalBallVariant = variant ?? (size <= 20 ? 'mark' : size <= 48 ? 'avatar' : 'large');
  const paint = state ? PAINT[state] : MASTER;
  const id = `ball${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const rimWidth = ((size <= 32 ? 0.75 : 1) * 200) / size;
  const h = paint.highlight;
  // A blurred ellipse spreads ≈2σ past its edge; the gradient ellipse covers that spread.
  const hx = h.rx + 2 * h.sigma;
  const hy = h.ry + 2 * h.sigma;

  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const spin = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(scale);
    cancelAnimation(opacity);
    cancelAnimation(spin);
    const ease = Easing.inOut(Easing.sin);
    if (reduceMotion || !state) {
      scale.value = withTiming(1, { duration: 200 });
      opacity.value = withTiming(1, { duration: 200 });
      spin.value = 0;
      return;
    }
    switch (state) {
      case 'idle':
        scale.value = withTiming(1, { duration: 400 });
        opacity.value = withRepeat(withSequence(withTiming(0.9, { duration: 2400, easing: ease }), withTiming(1, { duration: 2400, easing: ease })), -1);
        break;
      case 'listening':
        opacity.value = withTiming(1, { duration: 300 });
        scale.value = withRepeat(withSequence(withTiming(1.04, { duration: 1400, easing: ease }), withTiming(1, { duration: 1400, easing: ease })), -1);
        break;
      case 'reading':
        scale.value = withTiming(1, { duration: 300 });
        opacity.value =
          kind === 'large'
            ? withTiming(1, { duration: 300 })
            : withRepeat(withSequence(withTiming(0.8, { duration: 1100, easing: ease }), withTiming(1, { duration: 1100, easing: ease })), -1);
        spin.value = withRepeat(withTiming(360, { duration: 14000, easing: Easing.linear }), -1);
        break;
      case 'speaking':
        opacity.value = withTiming(1, { duration: 300 });
        scale.value = withSequence(
          withTiming(1.1, { duration: 500, easing: ease }),
          withRepeat(withSequence(withTiming(1.06, { duration: 900, easing: ease }), withTiming(1.1, { duration: 900, easing: ease })), -1),
        );
        break;
    }
  }, [state, reduceMotion, kind, scale, opacity, spin]);

  const bodyStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  const glintStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));

  const a11y = accessibilityLabel
    ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel }
    : { accessible: false, importantForAccessibility: 'no-hide-descendants' as const };

  return (
    <View style={[{ width: size, height: size }, style]} {...a11y}>
      <Animated.View style={[StyleSheet.absoluteFill, bodyStyle]}>
        <Svg width={size} height={size} viewBox="0 0 200 200">
          <Defs>
            <RadialGradient id={`${id}f`} gradientUnits="userSpaceOnUse" cx="66" cy="63" r="134" fx="66" fy="63">
              {paint.stops.map(([c, o]) => (
                <Stop key={o} offset={o} stopColor={c} />
              ))}
            </RadialGradient>
            <RadialGradient id={`${id}e`} gradientUnits="userSpaceOnUse" cx="100" cy="100" r="84" fx="100" fy="100">
              <Stop offset={paint.edgeFrom} stopColor={paint.edge} stopOpacity={0} />
              <Stop offset={1} stopColor={paint.edge} stopOpacity={paint.edgeOpacity} />
            </RadialGradient>
            {kind !== 'mark' && (
              <>
                <RadialGradient id={`${id}h`} cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                  <Stop offset={0} stopColor="#FFFFFF" stopOpacity={h.opacity} />
                  <Stop offset={0.4} stopColor="#FFFFFF" stopOpacity={h.opacity * 0.8} />
                  <Stop offset={1} stopColor="#FFFFFF" stopOpacity={0} />
                </RadialGradient>
                <ClipPath id={`${id}c`}>
                  <Circle cx="100" cy="100" r="84" />
                </ClipPath>
              </>
            )}
          </Defs>
          {kind === 'mark' ? (
            <>
              <Circle cx="100" cy="100" r="84" fill={`url(#${id}f)`} />
              <Circle cx="100" cy="100" r="84" fill={`url(#${id}e)`} />
            </>
          ) : (
            <G clipPath={`url(#${id}c)`}>
              <Circle cx="100" cy="100" r="92" fill={`url(#${id}f)`} />
              <Circle cx="100" cy="100" r="92" fill={`url(#${id}e)`} />
              <Ellipse cx={h.cx} cy={h.cy} rx={hx} ry={hy} fill={`url(#${id}h)`} />
              {kind === 'large' && (
                <Path
                  d="M173.4 119.7 A76 76 0 0 1 93.4 175.7"
                  fill="none"
                  stroke="#C7D6DC"
                  strokeOpacity={paint.reflex * 0.7}
                  strokeWidth={11}
                  strokeLinecap="round"
                />
              )}
              {paint.veil > 0 && <Circle cx="100" cy="100" r="84" fill={PARCEL} fillOpacity={paint.veil} />}
            </G>
          )}
          <Circle cx="100" cy="100" r="84" fill="none" stroke={RIM} strokeOpacity={paint.rimOpacity} strokeWidth={rimWidth} />
        </Svg>
      </Animated.View>
      {kind === 'large' && (
        <Animated.View style={[StyleSheet.absoluteFill, glintStyle]} pointerEvents="none">
          <Svg width={size} height={size} viewBox="0 0 200 200">
            <Path d={star(122, 112, 7)} fill={OXBLOOD} />
            <Path d={star(90, 124, 3)} fill={OXBLOOD} />
            {paint.whiteGlint && <Path d={star(142, 75, 3)} fill="#FFFFFF" fillOpacity={0.9} />}
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}
