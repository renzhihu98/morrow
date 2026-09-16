// Per-weight subpath imports so only these four TTFs are bundled (the package index requires every weight).
import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { GeistMono_400Regular } from '@expo-google-fonts/geist-mono/400Regular';
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif/400Regular';

/** Font assets to load at startup. Upright only — no italics anywhere (SPEC §4.2). */
export const fontAssets = {
  InstrumentSerif_400Regular,
  Geist_400Regular,
  Geist_500Medium,
  GeistMono_400Regular,
};

/** RN font family names (keys of `fontAssets`). */
export const family = {
  serif: 'InstrumentSerif_400Regular',
  sans: 'Geist_400Regular',
  sansMedium: 'Geist_500Medium',
  mono: 'GeistMono_400Regular',
} as const;
