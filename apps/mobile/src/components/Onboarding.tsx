import { StyleSheet, View } from 'react-native';
import { CrystalBall } from './CrystalBall';
import { Txt } from './Txt';

/**
 * Pre-sign-in header (Paper BVE/CAQ): 19pt ball + "Morrow" wordmark on the left,
 * a Geist note on the right ("Step 2 of 3"). No menu before sign-in.
 */
export function AuthHeader({ note }: { note?: string }) {
  return (
    <View style={styles.header}>
      <View style={styles.brand} accessibilityRole="header" accessibilityLabel="Morrow">
        <CrystalBall size={19} variant="mark" />
        <Txt variant="wordmark">Morrow</Txt>
      </View>
      {note ? (
        <Txt variant="label" color="textMuted">
          {note}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 40,
    paddingTop: 8,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
});
