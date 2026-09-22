import { typeScale, type TypeToken } from '@morrow/tokens';
import type { TextStyle } from 'react-native';
import { family } from './fonts';

/**
 * Txt variants: the mobile type-scale tokens (SPEC §4.D) plus `meta` — Geist Mono 12/16,
 * for numerals only (times, `09.30` dates, counts, likelihood, `n/15`).
 */
export type TxtVariant = TypeToken | 'meta';

const SERIF: readonly TypeToken[] = ['hero', 'display', 'title', 'confirm', 'prophecy', 'listItem', 'row', 'wordmark'];

/** px letter-spacing for React Native from an em value. */
export const em = (value: number, size: number) => Math.round(value * size * 100) / 100;

/** Family for a variant: Instrument Serif for headlines/statements, Geist Mono for `meta`, Geist otherwise. */
export function familyFor(variant: TxtVariant, medium = false): string {
  if (variant === 'meta') return family.mono;
  if ((SERIF as readonly string[]).includes(variant)) return family.serif;
  return medium ? family.sansMedium : family.sans;
}

/** Mobile type scale → RN TextStyle (tokens' `letterSpacing` is em → multiplied by size). */
export function typeStyle(variant: TxtVariant, medium = false): TextStyle {
  if (variant === 'meta') return monoStyle(12, 16);
  const t: { size: number; lineHeight: number; letterSpacing?: number } = typeScale.mobile[variant];
  return {
    fontFamily: familyFor(variant, medium),
    fontSize: t.size,
    lineHeight: t.lineHeight,
    ...(t.letterSpacing !== undefined ? { letterSpacing: em(t.letterSpacing, t.size) } : {}),
  };
}

/** Geist Mono — numerals only. Zero tracking by default (v4 has no tracked labels). */
export function monoStyle(size = 12, lineHeight = 16, tracking = 0): TextStyle {
  return { fontFamily: family.mono, fontSize: size, lineHeight, letterSpacing: em(tracking, size) };
}

export function serifStyle(size: number, lineHeight: number, tracking = 0): TextStyle {
  return { fontFamily: family.serif, fontSize: size, lineHeight, letterSpacing: em(tracking, size) };
}

export function sansStyle(size = 15, lineHeight = 22, medium = false): TextStyle {
  return { fontFamily: medium ? family.sansMedium : family.sans, fontSize: size, lineHeight };
}
