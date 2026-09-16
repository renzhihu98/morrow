import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { DemoBadge } from './DemoBadge';
import { Dot } from './Dot';
import { CloseIcon, MenuIcon } from './Icons';
import { Txt } from './Txt';

export type NavSection = 'today' | 'readings' | 'prophecies' | 'sources';

type Props = {
  /** Active nav item, forwarded to the menu sheet. */
  active?: NavSection;
  /** `close` renders × (menu sheet open). */
  mode?: 'menu' | 'close';
  onClose?: () => void;
};

/** Dot + "Morrow" wordmark with the menu ↔ close toggle (44pt tall, 24 gutter). */
export function Header({ active = 'today', mode = 'menu', onClose }: Props) {
  const { palette } = useTheme();
  const isClose = mode === 'close';
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Morrow, today"
        onPress={() => (isClose ? onClose?.() : router.navigate('/'))}
        style={styles.brand}
        hitSlop={8}
      >
        <Dot color={palette.accent} size={6} />
        <Txt style={styles.wordmark}>Morrow</Txt>
        <DemoBadge />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isClose ? 'Close menu' : 'Open menu'}
        hitSlop={12}
        onPress={() => (isClose ? onClose?.() : router.push({ pathname: '/menu', params: { active } }))}
      >
        {isClose ? <CloseIcon color={palette.textPrimary} /> : <MenuIcon color={palette.textSecondary} />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: 44,
    paddingTop: 6,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wordmark: { fontFamily: 'InstrumentSerif_400Regular', fontSize: 26, lineHeight: 30 },
});
