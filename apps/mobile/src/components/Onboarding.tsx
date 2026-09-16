import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { monoStyle, sansStyle } from '@/theme/typography';
import { Dot } from './Dot';
import { Txt } from './Txt';

/** Wordmark + right-aligned mono note ("PRIVATE BETA", "STEP 2 OF 3"). No menu before sign-in. */
export function AuthHeader({ note }: { note: string }) {
  const { palette } = useTheme();
  return (
    <View style={styles.header}>
      <View style={styles.brand} accessibilityRole="header" accessibilityLabel="Morrow">
        <Dot color={palette.accent} size={6} />
        <Txt style={styles.wordmark}>Morrow</Txt>
      </View>
      <Txt variant="label" color="textMuted" style={monoStyle(10, 12)}>
        {note}
      </Txt>
    </View>
  );
}

/** Full-width 52pt accent button used by the onboarding CTAs. */
export function PrimaryButton({
  label,
  onPress,
  disabled,
  busy,
  icon,
  trailing,
  height = 52,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  icon?: ReactNode;
  trailing?: ReactNode;
  height?: number;
  accessibilityHint?: string;
}) {
  const { palette } = useTheme();
  const inactive = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primary,
        { height, backgroundColor: palette.accentFill, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
      ]}
    >
      {busy ? <ActivityIndicator color={palette.onAccent} /> : icon}
      <Txt color="onAccent" style={sansStyle(15, 20, true)}>
        {label}
      </Txt>
      {busy ? null : trailing}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 44,
    paddingTop: 6,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wordmark: { fontFamily: 'InstrumentSerif_400Regular', fontSize: 26, lineHeight: 30 },
  primary: { borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
});
