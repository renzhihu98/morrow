/**
 * @morrow/tokens — v4 "Parcel" design tokens (SPEC §4, contract §6.1).
 * Plain TS objects, consumed directly (no build step) by Next.js and Expo/Metro.
 */

export type Palette = {
  bg: string;
  surface: string;
  hairline: string;
  text: string;
  textMuted: string;
  accent: string;
  onAccent: string;
  chambray: string;
  onChambray: string;
  highlight: string;
  danger: string;
  onDanger: string;
  dangerBorder: string;
};

export const colors = {
  /** Parcel — page ground, always flat. */
  bg: '#E5E3DA',
  /** Morrow bubbles, cards, composer, menu card. */
  surface: '#DAD7CB',
  /** Borders, dividers, nav underline (Black Fig at 14%). */
  hairline: 'rgba(41,16,12,0.14)',
  /** Black Fig — headlines, body, values. */
  text: '#29100C',
  /** Capers — secondary copy, meta, placeholders, inactive nav. */
  textMuted: '#53461C',
  /** Oxblood — primary buttons, send/stop, active nav, links, bars, moon glyphs, figure silhouette. */
  accent: '#5A1D22',
  onAccent: '#E5E3DA',
  /** Chambray — user bubbles, figure aura, crystal-ball shading. */
  chambray: '#A9C0CB',
  onChambray: '#29100C',
  /** Chartreuse — tiny status dots only (landed, live/typing, chakra points). Never carries text. */
  highlight: '#BFB065',
  /** Brick — destructive actions only. */
  danger: '#A3372A',
  onDanger: '#F4EFE6',
  dangerBorder: 'rgba(163,55,42,0.55)',
} as const satisfies Palette;

/** Crystal-ball paint (SPEC §4.E). Radial stops from highlight to edge, plus the closing rim. */
export const ball = {
  stops: ['#EEF1F2', '#E1E6E6', '#A9C0CB', '#7F97A3', '#62798A'],
  stopOffsets: [0, 0.14, 0.42, 0.72, 1],
  rim: 'rgba(94,116,130,0.45)',
} as const;

/** Paper grain overlay (SPEC §4.C). */
export const grain = {
  baseFrequency: 0.85,
  numOctaves: 2,
  opacity: 0.08,
  blend: 'multiply',
} as const;

/** Font family names. Load them via next/font/google (web) or @expo-google-fonts/* (mobile). No italics. */
export const fonts = {
  serif: 'Instrument Serif',
  sans: 'Geist',
  mono: 'Geist Mono',
} as const;

export type TypeToken =
  | 'hero'
  | 'display'
  | 'title'
  | 'confirm'
  | 'prophecy'
  | 'listItem'
  | 'row'
  | 'wordmark'
  | 'bodyLg'
  | 'body'
  | 'label';

/**
 * size and lineHeight in px. letterSpacing is in **em** (multiply by size for px, e.g. React Native).
 * Where SPEC §4.D gives a range, the upper value is used.
 */
export type TypeStyle = { size: number; lineHeight: number; letterSpacing?: number };

export const typeScale = {
  desktop: {
    hero: { size: 128, lineHeight: 120, letterSpacing: -0.02 },
    display: { size: 88, lineHeight: 88, letterSpacing: -0.02 },
    title: { size: 80, lineHeight: 80, letterSpacing: -0.02 },
    confirm: { size: 104, lineHeight: 100, letterSpacing: -0.02 },
    prophecy: { size: 26, lineHeight: 32, letterSpacing: -0.01 },
    listItem: { size: 24, lineHeight: 30, letterSpacing: -0.01 },
    row: { size: 22, lineHeight: 28, letterSpacing: -0.01 },
    wordmark: { size: 30, lineHeight: 36, letterSpacing: -0.01 },
    bodyLg: { size: 18, lineHeight: 28 },
    body: { size: 16, lineHeight: 24 },
    label: { size: 13, lineHeight: 16 },
  },
  mobile: {
    hero: { size: 56, lineHeight: 56, letterSpacing: -0.02 },
    display: { size: 46, lineHeight: 48, letterSpacing: -0.02 },
    title: { size: 52, lineHeight: 52, letterSpacing: -0.02 },
    confirm: { size: 46, lineHeight: 48, letterSpacing: -0.02 },
    prophecy: { size: 21, lineHeight: 27, letterSpacing: -0.01 },
    listItem: { size: 22, lineHeight: 27, letterSpacing: -0.01 },
    row: { size: 20, lineHeight: 26, letterSpacing: -0.01 },
    wordmark: { size: 24, lineHeight: 30, letterSpacing: -0.01 },
    bodyLg: { size: 16, lineHeight: 24 },
    body: { size: 15, lineHeight: 22 },
    label: { size: 12, lineHeight: 16 },
  },
} as const satisfies Record<'desktop' | 'mobile', Record<TypeToken, TypeStyle>>;

export const radii = {
  bubble: 20,
  bubbleTail: 6,
  card: 14,
  composer: 32,
  button: 28,
  dot: 999,
} as const;

export const space = {
  /** Desktop content column is 1088 wide, centred (x 176–1264 at 1440). */
  contentDesktop: 1088,
  /** Desktop chat thread column width. */
  threadDesktop: 760,
  navHeightDesktop: 88,
  navPaddingDesktop: 48,
  gutterMobile: 24,
  composerInsetMobile: 16,
} as const;
