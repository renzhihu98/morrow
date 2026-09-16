import { typeScale, type TypeToken } from '@morrow/tokens';
import type { TextStyle } from 'react-native';
import { family } from './fonts';

const SERIF: TypeToken[] = ['display', 'title', 'confirm', 'answer', 'prophecy', 'listItem', 'row'];

/** px letter-spacing for React Native from an em value. */
export const em = (value: number, size: number) => Math.round(value * size * 100) / 100;

/** Family for a scale token: serif for voice/titles, mono for labels, Geist for body. */
export function familyFor(token: TypeToken): string {
  if (token === 'label') return family.mono;
  return SERIF.includes(token) ? family.serif : family.sans;
}

/** Mobile type scale → RN TextStyle (tokens' `letterSpacing` is em → multiplied by size). */
export function typeStyle(token: TypeToken): TextStyle {
  const t: { size: number; lineHeight: number; letterSpacing?: number } = typeScale.mobile[token];
  return {
    fontFamily: familyFor(token),
    fontSize: t.size,
    lineHeight: t.lineHeight,
    ...(t.letterSpacing !== undefined ? { letterSpacing: em(t.letterSpacing, t.size) } : {}),
  };
}

/** Ad-hoc mono label (10–12px) with the 0.04em label tracking. */
export function monoStyle(size = 11, lineHeight = 14, tracking = 0.04): TextStyle {
  return { fontFamily: family.mono, fontSize: size, lineHeight, letterSpacing: em(tracking, size) };
}

export function serifStyle(size: number, lineHeight: number, tracking = 0): TextStyle {
  return { fontFamily: family.serif, fontSize: size, lineHeight, letterSpacing: em(tracking, size) };
}

export function sansStyle(size = 15, lineHeight = 22, medium = false): TextStyle {
  return { fontFamily: medium ? family.sansMedium : family.sans, fontSize: size, lineHeight };
}
