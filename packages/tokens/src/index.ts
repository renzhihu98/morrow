/**
 * @morrow/tokens — "Deep field" design tokens (SPEC §4, contract §6.1).
 * Plain TS objects, consumed directly (no build step) by Next.js and Expo/Metro.
 */

export type Palette = {
  bg: string;
  panel: string;
  subtle: string;
  hairline: string;
  hairlineStrong: string;
  orbitFaint: string;
  orbitLine: string;
  tick: string;
  textFaint: string;
  textMuted: string;
  placeholder: string;
  textSecondary: string;
  textPrimary: string;
  accent: string;
  accentFill: string;
  onAccent: string;
  danger: string;
  onDanger: string;
};

export const colors = {
  bg: '#F3F4F6',
  panel: '#FFFFFF',
  subtle: '#E6E8EC',
  hairline: '#DDE0E5',
  hairlineStrong: '#C9CDD4',
  orbitFaint: '#E1E3E7',
  orbitLine: '#C9CDD4',
  tick: '#BFC3CA',
  textFaint: '#B5B9C0',
  textMuted: '#6E737D',
  placeholder: '#8A8F98',
  textSecondary: '#4E535B',
  textPrimary: '#16181C',
  accent: '#2F8A6C',
  accentFill: '#BFE8D8',
  onAccent: '#16181C',
  danger: '#B8574A',
  onDanger: '#FFFFFF',
} as const satisfies Palette;

/** Transparent variants used in the designs (SPEC §4.1). */
export const alphaColors = {
  accentBorder: 'rgba(47,138,108,0.45)',
  dangerBorder: 'rgba(184,87,74,0.5)',
} as const satisfies { accentBorder: string; dangerBorder: string };

/** Font family names. Load them via next/font/google (web) or @expo-google-fonts/* (mobile). No italics. */
export const fonts = {
  serif: 'Instrument Serif',
  sans: 'Geist',
  mono: 'Geist Mono',
} as const;

export type TypeToken =
  | 'display'
  | 'title'
  | 'confirm'
  | 'answer'
  | 'prophecy'
  | 'listItem'
  | 'row'
  | 'bodyLg'
  | 'body'
  | 'label';

/**
 * size and lineHeight in px. letterSpacing is in **em** (multiply by size for px, e.g. React Native).
 * Where SPEC §4.2 gives a range, the upper value is used.
 */
export type TypeStyle = { size: number; lineHeight: number; letterSpacing?: number };

export const typeScale = {
  desktop: {
    display: { size: 76, lineHeight: 76, letterSpacing: -0.015 },
    title: { size: 68, lineHeight: 68, letterSpacing: -0.015 },
    confirm: { size: 60, lineHeight: 62, letterSpacing: -0.01 },
    answer: { size: 42, lineHeight: 46, letterSpacing: -0.01 },
    prophecy: { size: 28, lineHeight: 34, letterSpacing: -0.01 },
    listItem: { size: 24, lineHeight: 30 },
    row: { size: 21, lineHeight: 26 },
    bodyLg: { size: 18, lineHeight: 28 },
    body: { size: 16, lineHeight: 24 },
    label: { size: 12, lineHeight: 16, letterSpacing: 0.04 },
  },
  mobile: {
    display: { size: 46, lineHeight: 46, letterSpacing: -0.015 },
    title: { size: 46, lineHeight: 46, letterSpacing: -0.015 },
    confirm: { size: 42, lineHeight: 44, letterSpacing: -0.01 },
    answer: { size: 32, lineHeight: 35, letterSpacing: -0.01 },
    prophecy: { size: 23, lineHeight: 28, letterSpacing: -0.01 },
    listItem: { size: 22, lineHeight: 27 },
    row: { size: 19, lineHeight: 24 },
    bodyLg: { size: 16, lineHeight: 24 },
    body: { size: 15, lineHeight: 23 },
    label: { size: 11, lineHeight: 14, letterSpacing: 0.04 },
  },
} as const satisfies Record<'desktop' | 'mobile', Record<TypeToken, TypeStyle>>;

export const radii = {
  panel: 16,
  card: 14,
  button: 10,
  glyph: 10,
  dot: 999,
} as const;

export const space = {
  gutterDesktop: 120,
  gutterMobile: 24,
  composerInsetMobile: 16,
} as const;
