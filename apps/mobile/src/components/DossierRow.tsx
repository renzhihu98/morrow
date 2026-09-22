import type { DossierFact, DossierPattern } from '@morrow/core';
import { Pressable, StyleSheet, View } from 'react-native';
import { sourceShortList } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { ink } from '@/theme/ink';
import { Txt } from './Txt';

/**
 * Dossier fact (v4 screen 13, Paper C9R): Geist label + the sources it came from on the right,
 * serif value. Tap to swap the sources for a Brick "Forget this ×". No section icons.
 */
export function DossierRow({
  fact,
  selected,
  onSelect,
  onForget,
  forgetting,
}: {
  fact: DossierFact;
  selected: boolean;
  onSelect: () => void;
  onForget: () => void;
  forgetting?: boolean;
}) {
  const { palette } = useTheme();
  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityLabel={`${fact.label}: ${fact.value}`}
      accessibilityHint="Shows the option to forget this fact"
      style={[styles.row, { borderTopColor: palette.hairline }, forgetting && { opacity: 0.4 }]}
    >
      <View style={styles.between}>
        <Txt variant="label" color="textMuted" style={styles.label}>
          {fact.label}
        </Txt>
        {selected ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Forget ${fact.label}`} hitSlop={10} onPress={onForget}>
            <Txt variant="label" color="danger" style={styles.label}>
              Forget this ×
            </Txt>
          </Pressable>
        ) : (
          <Txt variant="label" color="textMuted">
            {sourceShortList(fact.sources)}
          </Txt>
        )}
      </View>
      <Txt variant="row">{fact.value}</Txt>
    </Pressable>
  );
}

/** Inferred pattern: dashed dividers, muted serif statement, mono confidence. */
export function PatternRow({ pattern }: { pattern: DossierPattern }) {
  return (
    <View style={[styles.pattern, { borderColor: ink.dashed }]}>
      <Txt variant="row" color="textMuted" style={{ flex: 1 }}>
        {pattern.statement}
      </Txt>
      <Txt variant="meta" accessibilityLabel={`Confidence ${pattern.confidence.toFixed(2)}`}>
        {pattern.confidence.toFixed(2)}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { borderTopWidth: 1, paddingTop: 12, paddingBottom: 14, gap: 4 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  label: { fontSize: 13, lineHeight: 18 },
  pattern: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    marginBottom: -1,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
});
