import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';

export type OrbitState = 'idle' | 'reading' | 'fulfilled' | 'sealed';

type Props = {
  state?: OrbitState;
  size?: number;
  /** Disable the slow rotation (always off when the OS asks for reduced motion). */
  still?: boolean;
};

const C = 330;

/**
 * Morrow's orbit diagram (SPEC §4.4), viewBox 660×660. Three stacked layers so the
 * tilted ellipses + source nodes can rotate gently beneath a static core.
 */
export function Orbit({ state = 'idle', size = 236, still = false }: Props) {
  const { palette, coreFill } = useTheme();
  const reduceMotion = useReducedMotion();
  const rotation = useSharedValue(0);
  const animate = !still && !reduceMotion && state !== 'sealed';
  const reading = state === 'reading';

  useEffect(() => {
    if (!animate) {
      cancelAnimation(rotation);
      rotation.value = withTiming(0, { duration: 600 });
      return;
    }
    if (reading) {
      // Reading: a slow continuous turn.
      rotation.value = withRepeat(withTiming(rotation.value + 360, { duration: 48_000, easing: Easing.linear }), -1, false);
    } else {
      // Idle / fulfilled: a gentle sway that keeps the composition close to the design.
      rotation.value = -7;
      rotation.value = withRepeat(withTiming(7, { duration: 9_000, easing: Easing.inOut(Easing.sin) }), -1, true);
    }
    return () => cancelAnimation(rotation);
  }, [animate, reading, rotation]);

  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  const sealed = state === 'sealed';
  const accent = sealed ? palette.textMuted : palette.accent;
  const sw = 2.5;
  const layer = { width: size, height: size } as const;

  return (
    <View
      style={[layer, sealed && { opacity: 0.58 }]}
      accessibilityRole="image"
      accessibilityLabel={`Orbit, ${state}`}
    >
      {/* rings + crosshair ticks */}
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 660 660">
        <Circle cx={C} cy={C} r={260} fill="none" stroke={palette.orbitFaint} strokeWidth={sw} />
        <Circle
          cx={C}
          cy={C}
          r={170}
          fill="none"
          stroke={state === 'reading' ? palette.accent : palette.hairline}
          strokeOpacity={state === 'reading' ? 0.7 : 1}
          strokeWidth={sw}
          strokeDasharray="5 14"
        />
        <Path d="M330 44 V62 M330 598 V616 M44 330 H62 M598 330 H616" fill="none" stroke={palette.tick} strokeWidth={sw} />
      </Svg>

      {/* tilted ellipses + source nodes */}
      <Animated.View style={[StyleSheet.absoluteFill, spin]}>
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 660 660">
          <G>
            <Ellipse cx={C} cy={C} rx={310} ry={92} transform="rotate(-18 330 330)" fill="none" stroke={palette.orbitLine} strokeWidth={sw} />
            <Ellipse
              cx={C}
              cy={C}
              rx={250}
              ry={64}
              transform="rotate(34 330 330)"
              fill="none"
              stroke={state === 'fulfilled' ? palette.accent : palette.hairline}
              strokeOpacity={state === 'fulfilled' ? 0.55 : 1}
              strokeWidth={sw}
            />
            <Circle cx={63} cy={450} r={9} fill={palette.textSecondary} />
            <Circle cx={538} cy={200} r={9} fill={palette.textSecondary} />
            <Circle cx={512} cy={480} r={10} fill={accent} />
          </G>
        </Svg>
      </Animated.View>

      {/* core */}
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 660 660">
        <Circle
          cx={C}
          cy={C}
          r={58}
          fill={coreFill}
          stroke={state === 'fulfilled' ? palette.accent : palette.tick}
          strokeOpacity={state === 'fulfilled' ? 0.6 : 1}
          strokeWidth={sw}
        />
        {!sealed && (
          <Circle cx={C} cy={C} r={state === 'fulfilled' ? 34 : 22} fill={palette.accent} fillOpacity={state === 'fulfilled' ? 0.16 : 0.08} />
        )}
        <Circle cx={C} cy={C} r={9} fill={accent} />
      </Svg>
    </View>
  );
}

/** 26px header mini-orbit (screens 02/06/07). */
export function MiniOrbit({ size = 26, active = false }: { size?: number; active?: boolean }) {
  const { palette } = useTheme();
  const reduceMotion = useReducedMotion();
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (!active || reduceMotion) {
      cancelAnimation(rotation);
      rotation.value = withTiming(0, { duration: 400 });
      return;
    }
    rotation.value = withRepeat(withTiming(rotation.value + 360, { duration: 6000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(rotation);
  }, [active, reduceMotion, rotation]);

  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  return (
    <Animated.View style={[{ width: size, height: size }, spin]} accessible={false}>
      <Svg width={size} height={size} viewBox="0 0 660 660">
        <Circle cx={C} cy={C} r={260} fill="none" stroke={palette.tick} strokeWidth={22} />
        <Ellipse cx={C} cy={C} rx={310} ry={92} transform="rotate(-18 330 330)" fill="none" stroke={palette.tick} strokeWidth={22} />
        <Circle cx={C} cy={C} r={70} fill={palette.accent} />
      </Svg>
    </Animated.View>
  );
}

/** Dashed, fading orbit on the Forget screen (12). */
export function FadingOrbit({ size = 76 }: { size?: number }) {
  const { palette } = useTheme();
  return (
    <View style={{ width: size, height: size, opacity: 0.8 }} accessible={false}>
      <Svg width={size} height={size} viewBox="0 0 660 660">
        <Circle cx={C} cy={C} r={260} fill="none" stroke={palette.tick} strokeWidth={10} strokeDasharray="4 26" strokeOpacity={0.7} />
        <Ellipse
          cx={C}
          cy={C}
          rx={310}
          ry={92}
          transform="rotate(-18 330 330)"
          fill="none"
          stroke={palette.tick}
          strokeWidth={10}
          strokeDasharray="4 22"
        />
        <Circle cx={C} cy={C} r={58} fill="none" stroke={palette.textMuted} strokeWidth={10} />
        <Circle cx={C} cy={C} r={16} fill={palette.textMuted} />
        <Circle cx={580} cy={130} r={18} fill={palette.textMuted} />
        <Circle cx={80} cy={520} r={16} fill={palette.tick} />
      </Svg>
    </View>
  );
}
