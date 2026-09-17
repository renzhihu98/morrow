import { StyleSheet, TextInput, View } from 'react-native';
import { isForgetConfirmed } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { family } from '@/theme/fonts';
import { em } from '@/theme/typography';
import { Txt } from './Txt';

/** "Type FORGET to confirm" input; border turns danger once the word matches. */
export function ConfirmInput({ value, onChangeText }: { value: string; onChangeText: (v: string) => void }) {
  const { palette, alpha } = useTheme();
  const ok = isForgetConfirmed(value);
  return (
    <View style={{ gap: 8 }}>
      <Txt variant="label" color="textMuted" style={{ fontSize: 10, lineHeight: 12 }}>
        Type FORGET to confirm
      </Txt>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="characters"
        autoCorrect={false}
        spellCheck={false}
        placeholder="FORGET"
        placeholderTextColor={palette.textFaint}
        selectionColor={palette.danger}
        cursorColor={palette.danger}
        accessibilityLabel="Type FORGET to confirm"
        style={[
          styles.input,
          {
            color: palette.textPrimary,
            backgroundColor: palette.panel,
            borderColor: ok ? alpha.dangerBorder : palette.hairline,
            fontFamily: family.mono,
            letterSpacing: em(0.06, 16),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input: { height: 44, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, fontSize: 16 },
});
