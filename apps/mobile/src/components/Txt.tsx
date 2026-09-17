import type { Palette, TypeToken } from '@morrow/tokens';
import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { typeStyle } from '@/theme/typography';

type Props = TextProps & {
  /** Mobile type-scale token (SPEC §4.2). Defaults to `body`. */
  variant?: TypeToken;
  color?: keyof Palette;
  style?: StyleProp<TextStyle>;
};

/** Themed text bound to the Morrow type scale. No italics anywhere. */
export function Txt({ variant = 'body', color = 'textPrimary', style, children, ...rest }: Props) {
  const { palette } = useTheme();
  return (
    <Text
      allowFontScaling
      maxFontSizeMultiplier={1.4}
      {...rest}
      style={[typeStyle(variant), { color: palette[color], fontStyle: 'normal' }, style]}
    >
      {children}
    </Text>
  );
}
