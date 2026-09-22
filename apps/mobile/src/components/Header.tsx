import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { CrystalBall, type CrystalBallState } from './CrystalBall';
import { DemoBadge } from './DemoBadge';
import { Dot } from './Dot';
import { BackIcon, CloseIcon, MenuIcon, MoreIcon } from './Icons';
import { Txt } from './Txt';

export type NavSection = 'today' | 'readings' | 'prophecies' | 'sources';

type Props = {
  /** Active nav item, forwarded to the menu sheet. */
  active?: NavSection;
  /**
   * Right-hand control: `menu` (≡, opens the menu sheet), `close` (×, closes the menu sheet),
   * `back` (‹ on the left of the wordmark), or `none`.
   */
  mode?: 'menu' | 'close' | 'back' | 'none';
  onClose?: () => void;
  /** Back handler; defaults to `router.back()`. */
  onBack?: () => void;
  /** Replaces the right-hand control (e.g. a step label during onboarding). */
  right?: ReactNode;
};

/**
 * v4 mobile header (SPEC §4.F): 19pt crystal ball + "Morrow" wordmark on the left,
 * menu / close on the right, 24pt side margin. No status or source text.
 */
export function Header({ active = 'today', mode = 'menu', onClose, onBack, right }: Props) {
  const { palette } = useTheme();
  const isClose = mode === 'close';
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.navigate('/')));
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        {mode === 'back' && (
          <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} onPress={back}>
            <BackIcon color={palette.accent} />
          </Pressable>
        )}
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Morrow, today"
          onPress={() => (isClose ? onClose?.() : router.navigate('/'))}
          style={styles.brand}
          hitSlop={8}
        >
          <CrystalBall size={19} variant="mark" />
          <Txt variant="wordmark">Morrow</Txt>
          <DemoBadge />
        </Pressable>
      </View>
      {right ??
        (mode === 'menu' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open menu"
            hitSlop={12}
            onPress={() => router.push({ pathname: '/menu', params: { active } })}
          >
            <MenuIcon color={palette.text} />
          </Pressable>
        ) : isClose ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Close menu" hitSlop={12} onPress={onClose}>
            <CloseIcon color={palette.accent} />
          </Pressable>
        ) : null)}
    </View>
  );
}

type ChatHeaderProps = {
  onBack?: () => void;
  onMore?: () => void;
  /** Status line under the name. Default "Online". */
  status?: string;
  /** Show the Chartreuse live dot before the status. Default true. */
  live?: boolean;
  /** Motion state of the 32pt ball (e.g. `reading` while Morrow is thinking). */
  ballState?: CrystalBallState;
};

/**
 * Chat header (Paper BQQ/BH0/C7K): back, 32pt ball, "Morrow" + "Online", more.
 * 16pt side padding and a hairline underline, as on the mobile chat artboards.
 */
export function ChatHeader({ onBack, onMore, status = 'Online', live = true, ballState }: ChatHeaderProps) {
  const { palette } = useTheme();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.navigate('/')));
  return (
    <View style={[styles.chatRow, { borderBottomColor: palette.hairline }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} onPress={back}>
        <BackIcon color={palette.accent} />
      </Pressable>
      <CrystalBall size={32} variant="avatar" state={ballState} />
      <View style={styles.chatName}>
        <Txt variant="wordmark" style={styles.chatWordmark} accessibilityRole="header">
          Morrow
        </Txt>
        <View style={styles.status}>
          {live && <Dot color={palette.highlight} />}
          <Txt variant="label" color="textMuted">
            {status}
          </Txt>
        </View>
      </View>
      {onMore ? (
        <Pressable accessibilityRole="button" accessibilityLabel="More" hitSlop={12} onPress={onMore}>
          <MoreIcon color={palette.accent} />
        </Pressable>
      ) : (
        <View style={{ width: 24 }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 40,
    paddingTop: 8,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  chatName: { flex: 1, gap: 2 },
  chatWordmark: { fontSize: 22, lineHeight: 24, letterSpacing: -0.22 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
