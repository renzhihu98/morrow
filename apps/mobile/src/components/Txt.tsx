import type { Palette } from '@morrow/tokens';
import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { typeStyle, type TxtVariant } from '@/theme/typography';

export type { TxtVariant };

type Props = TextProps & {
  /**
   * Mobile type-scale variant (SPEC §4.D). Defaults to `body`.
   * Serif: hero · display · title · confirm · prophecy · listItem · row · wordmark.
   * Geist: bodyLg · body · label. Geist Mono (numerals only): meta.
   */
  variant?: TxtVariant;
  /** Geist 500 (ignored for serif/mono variants). */
  medium?: boolean;
  color?: keyof Palette;
  style?: StyleProp<TextStyle>;
};

/** Themed text bound to the Morrow type scale. Upright only, never uppercase. */
export function Txt({ variant = 'body', medium = false, color = 'text', style, children, ...rest }: Props) {
  const { palette } = useTheme();
  return (
    <Text
      allowFontScaling
      maxFontSizeMultiplier={1.4}
      {...rest}
      style={[typeStyle(variant, medium), { color: palette[color], fontStyle: 'normal', textTransform: 'none' }, style]}
    >
      {children}
    </Text>
  );
}
