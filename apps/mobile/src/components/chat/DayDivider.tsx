import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Txt } from '../Txt';

type Props = {
  /** Sentence case, e.g. "Today · 06:43" or "Tue 16 Sept · 06:43". */
  label: string;
  /** Draw hairlines either side (desktop style). Mobile artboards show the label alone. Default false. */
  lines?: boolean;
  /** Extra top space for a divider inside a thread (Paper: 6pt). */
  inset?: boolean;
};

/** Day / time divider between chat turns (SPEC §4.F): centred Geist 12/16 in `textMuted`. */
export function DayDivider({ label, lines = false, inset = false }: Props) {
  const { palette } = useTheme();
  return (
    <View style={[styles.row, inset && { paddingTop: 6 }]} accessibilityRole="header">
      {lines && <View style={[styles.line, { backgroundColor: palette.hairline }]} />}
      <Txt variant="label" color="textMuted">
        {label}
      </Txt>
      {lines && <View style={[styles.line, { backgroundColor: palette.hairline }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  line: { flex: 1, height: 1 },
});
