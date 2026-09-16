import type { Palette, TypeToken } from '@morrow/tokens';
import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { typeStyle } from '@/theme/typography';

type Props = TextProps & {
  /** Mobile type-scale token (SPEC §4.2). Defaults to `body`. */
  variant?: TypeToken;
  color?: keyof Palette;
  /** Uppercase mono labels. Applied automatically for `label`. */
  upper?: boolean;
  style?: StyleProp<TextStyle>;
};

/** Themed text bound to the Morrow type scale. No italics anywhere. */
export function Txt({ variant = 'body', color = 'textPrimary', upper, style, children, ...rest }: Props) {
  const { palette } = useTheme();
  const shouldUpper = upper ?? variant === 'label';
  const content =
    shouldUpper && typeof children === 'string'
      ? children.toUpperCase()
      : shouldUpper && Array.isArray(children)
        ? children.map((c) => (typeof c === 'string' ? c.toUpperCase() : c))
        : children;
  return (
    <Text
      allowFontScaling
      maxFontSizeMultiplier={1.4}
      {...rest}
      style={[typeStyle(variant), { color: palette[color], fontStyle: 'normal' }, style]}
    >
      {content}
    </Text>
  );
}
