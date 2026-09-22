import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { ink } from '@/theme/ink';
import { Txt } from './Txt';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'link' | 'dangerLink';

type Props = {
  label: string;
  onPress?: () => void;
  /**
   * `primary`: Oxblood fill, Parcel text. `secondary`: 1px ink outline, text colour.
   * `danger`: Brick fill (Forget everything only). `link`: Oxblood underlined text. `dangerLink`: Brick text link.
   */
  variant?: ButtonVariant;
  /** Leading icon (e.g. <GoogleIcon color={palette.onAccent} />). */
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * v4 buttons (SPEC §4.F; Paper BVE/B4T): full-width, 56pt tall, radius 14 on mobile,
 * Geist 500 16/20. Links are Geist 14/20 with an underline.
 */
export function Button({ label, onPress, variant = 'primary', icon, disabled, loading, accessibilityLabel, style }: Props) {
  const { palette } = useTheme();
  const inactive = disabled || loading;

  if (variant === 'link' || variant === 'dangerLink') {
    return (
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: !!inactive }}
        disabled={inactive}
        onPress={onPress}
        hitSlop={10}
        style={({ pressed }) => [styles.link, { opacity: inactive ? 0.5 : pressed ? 0.7 : 1 }, style]}
      >
        <Txt color={variant === 'dangerLink' ? 'danger' : 'accent'} style={styles.linkText}>
          {label}
        </Txt>
      </Pressable>
    );
  }

  const fill =
    variant === 'primary'
      ? { backgroundColor: palette.accent }
      : variant === 'danger'
        ? { backgroundColor: palette.danger }
        : { borderWidth: 1, borderColor: ink.outline };
  const textColor = variant === 'primary' ? 'onAccent' : variant === 'danger' ? 'onDanger' : 'text';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [styles.button, fill, { opacity: disabled ? 0.45 : pressed ? 0.85 : 1 }, style]}
    >
      {loading ? (
        <ActivityIndicator color={palette[textColor]} />
      ) : (
        <View style={styles.inner}>
          {icon}
          <Txt medium color={textColor} style={styles.text}>
            {label}
          </Txt>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: { fontSize: 16, lineHeight: 20 },
  link: { alignSelf: 'center', paddingVertical: 3 },
  linkText: { fontSize: 14, lineHeight: 20, textDecorationLine: 'underline' },
});
