import { radii } from '@morrow/tokens';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { CrystalBall, type CrystalBallState } from '../CrystalBall';
import { Txt } from '../Txt';

/** Thread container spacing on the mobile chat artboards (BQQ/BH0/C7K). */
export const THREAD_STYLE: ViewStyle = { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20, gap: 14 };
/** Avatar column (28pt ball + 8pt gap): left inset for full-width Morrow content such as the prophecy card. */
export const AVATAR_COLUMN = 36;

type Props = {
  from: 'user' | 'morrow';
  /** Plain strings render as Geist 16/24 bubble text; any other node renders as-is inside the bubble. */
  children: ReactNode;
  /**
   * Morrow only: last bubble of a consecutive group. The last one carries the avatar and the
   * 6pt tail; earlier ones keep the avatar slot empty and round all corners. Default true.
   */
  last?: boolean;
  /** Morrow only: render children without bubble chrome, in the bubble column (e.g. an inline ProphecyCard). */
  bare?: boolean;
  /** Morrow only: avatar motion state. */
  ballState?: CrystalBallState;
  style?: StyleProp<ViewStyle>;
};

/**
 * One chat message (SPEC §4.F). User: Chambray bubble on the right, radius 20/20/6/20, max 296.
 * Morrow: 28pt ball avatar + `surface` bubble with hairline, radius 20/20/20/6, max 282.
 */
export function MessageRow({ from, children, last = true, bare = false, ballState, style }: Props) {
  const { palette } = useTheme();
  const content =
    typeof children === 'string' ? (
      <Txt variant="bodyLg" color={from === 'user' ? 'onChambray' : 'text'} selectable>
        {children}
      </Txt>
    ) : (
      children
    );

  if (from === 'user') {
    return (
      <View style={[styles.user, { backgroundColor: palette.chambray }, style]} accessibilityLabel={typeof children === 'string' ? `You: ${children}` : undefined}>
        {content}
      </View>
    );
  }

  return (
    <View style={[styles.morrowRow, bare && styles.bareRow, style]}>
      <View style={[styles.avatar, !last && { opacity: 0 }]} accessible={false}>
        {last && <CrystalBall size={28} variant="avatar" state={ballState} />}
      </View>
      {bare ? (
        <View style={styles.bare}>{content}</View>
      ) : (
        <View
          style={[
            styles.morrow,
            { backgroundColor: palette.surface, borderColor: palette.hairline },
            last && { borderBottomLeftRadius: radii.bubbleTail },
          ]}
        >
          {content}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  user: {
    alignSelf: 'flex-end',
    maxWidth: 296,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: radii.bubble,
    borderBottomRightRadius: radii.bubbleTail,
  },
  morrowRow: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '100%' },
  bareRow: { alignSelf: 'stretch' },
  avatar: { width: 28, height: 28 },
  morrow: {
    flexShrink: 1,
    maxWidth: 282,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: radii.bubble,
  },
  bare: { flex: 1 },
});
