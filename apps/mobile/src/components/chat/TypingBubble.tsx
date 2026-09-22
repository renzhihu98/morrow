import { radii } from '@morrow/tokens';
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
  type SharedValue,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';
import { CrystalBall } from '../CrystalBall';
import { Txt } from '../Txt';

type Props = {
  /** Default "Morrow is reading". Never list sources here (SPEC §4.A.5). */
  label?: string;
};

const REST = [1, 0.55, 0.3];

function TypingDot({ color, index, phase }: { color: string; index: number; phase: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    // The bright spot walks across the three dots; at rest they keep the Paper opacities.
    const p = phase.value;
    if (p < 0) return { opacity: REST[index] };
    const d = (((p - index) % 3) + 3) % 3;
    const near = Math.min(d, 3 - d);
    return { opacity: 1 - Math.min(near, 1) * 0.6 };
  });
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

/** Morrow's thinking state (Paper BH0): avatar + small bubble with "Morrow is reading" and three dots. */
export function TypingBubble({ label = 'Morrow is reading' }: Props) {
  const { palette } = useTheme();
  const reduceMotion = useReducedMotion();
  const phase = useSharedValue(-1);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(phase);
      phase.value = -1;
      return;
    }
    phase.value = 0;
    phase.value = withRepeat(withTiming(3, { duration: 1500, easing: Easing.linear }), -1);
    return () => cancelAnimation(phase);
  }, [reduceMotion, phase]);

  return (
    <View style={styles.row} accessible accessibilityRole="text" accessibilityLabel={`${label}…`} accessibilityLiveRegion="polite">
      <CrystalBall size={28} variant="avatar" state="reading" />
      <View style={[styles.bubble, { backgroundColor: palette.surface, borderColor: palette.hairline }]}>
        <Txt variant="label" color="accent">
          {label}
        </Txt>
        <View style={styles.dots}>
          <TypingDot color={palette.highlight} index={0} phase={phase} />
          <TypingDot color={palette.textMuted} index={1} phase={phase} />
          <TypingDot color={palette.textMuted} index={2} phase={phase} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderWidth: 1,
    borderRadius: radii.bubble,
    borderBottomLeftRadius: radii.bubbleTail,
  },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
