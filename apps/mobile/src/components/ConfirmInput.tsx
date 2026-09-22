import { StyleSheet, TextInput, View } from 'react-native';
import { isForgetConfirmed } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { family } from '@/theme/fonts';
import { em } from '@/theme/typography';
import { Txt } from './Txt';

type Props = { value: string; onChangeText: (v: string) => void };

/**
 * "Type FORGET to confirm" (Paper B4T): `surface` field, radius 12, 48pt, Brick border + caret.
 * The typed word is the one sanctioned all-caps string in the app (SPEC §4.D).
 */
export function ConfirmInput({ value, onChangeText }: Props) {
  const { palette } = useTheme();
  const ok = isForgetConfirmed(value);
  return (
    <View style={styles.wrap}>
      <Txt color="textMuted" style={styles.label}>
        Type FORGET to confirm
      </Txt>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="characters"
        autoCorrect={false}
        spellCheck={false}
        placeholder="FORGET"
        placeholderTextColor={palette.textMuted}
        selectionColor={palette.danger}
        cursorColor={palette.danger}
        accessibilityLabel="Type FORGET to confirm"
        accessibilityHint={ok ? 'Confirmed' : undefined}
        style={[
          styles.input,
          {
            color: palette.text,
            backgroundColor: palette.surface,
            borderColor: ok ? palette.danger : palette.dangerBorder,
            fontFamily: family.mono,
            letterSpacing: em(0.08, 15),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontSize: 13, lineHeight: 18 },
  input: { height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, fontSize: 15 },
});
