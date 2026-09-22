import { grain } from '@morrow/tokens';
import { Image, StyleSheet, View } from 'react-native';

const TILE = require('../../assets/grain.png');

/**
 * `assets/grain.png` stores the web grain's darkening d = A·(1−L) as the alpha of black,
 * normalised by its peak (0.6315). A black layer at alpha a darkens exactly like
 * `multiply` with white-to-black noise, so opacity = grain.opacity × peak reproduces the
 * web's `mix-blend-mode: multiply; opacity: .08`. Regenerate with `node scripts/make-grain.mjs`.
 */
const GRAIN_PEAK = 0.6315;
export const GRAIN_OPACITY = grain.opacity * GRAIN_PEAK;

/**
 * Paper grain (SPEC §4.C): one full-bleed tiled overlay, top layer, never intercepts touches.
 * Mounted once in the root layout; screens don't render their own.
 */
export function Grain() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessible={false} importantForAccessibility="no-hide-descendants">
      <Image
        source={TILE}
        resizeMode="repeat"
        style={[StyleSheet.absoluteFill, { width: '100%', height: '100%', opacity: GRAIN_OPACITY }]}
        accessible={false}
        fadeDuration={0}
      />
    </View>
  );
}
