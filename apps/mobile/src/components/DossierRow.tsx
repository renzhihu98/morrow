import type { DossierFact, DossierPattern } from '@morrow/core';
import { Pressable, StyleSheet, View } from 'react-native';
import { sourceShortList } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { monoStyle } from '@/theme/typography';
import { Txt } from './Txt';

/** Dossier fact (11): mono label + sources, serif value. Tap to reveal "FORGET THIS ×". */
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
      accessibilityHint="Shows the option to forget this fact"
      style={[styles.row, { borderTopColor: palette.hairline }, forgetting && { opacity: 0.4 }]}
    >
      <View style={styles.between}>
        <Txt variant="label" color="textMuted" style={{ fontSize: 10, lineHeight: 12 }}>
          {fact.label}
        </Txt>
        {selected ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Forget ${fact.label}`} hitSlop={10} onPress={onForget}>
            <Txt variant="label" color="accent" style={{ fontSize: 10, lineHeight: 12 }}>
              FORGET THIS ×
            </Txt>
          </Pressable>
        ) : (
          <Txt variant="label" color="textMuted" style={{ fontSize: 10, lineHeight: 12 }}>
            {sourceShortList(fact.sources)}
          </Txt>
        )}
      </View>
      <Txt variant="row">{fact.value}</Txt>
    </Pressable>
  );
}

/** Inferred pattern: dashed divider, muted serif statement, confidence. */
export function PatternRow({ pattern }: { pattern: DossierPattern }) {
  const { palette } = useTheme();
  return (
    <View style={[styles.pattern, { borderColor: palette.hairlineStrong }]}>
      <Txt variant="row" color="textSecondary" style={{ flex: 1 }}>
        {pattern.statement}
      </Txt>
      <Txt style={monoStyle(11, 14, 0)}>{pattern.confidence.toFixed(2)}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { borderTopWidth: 1, paddingVertical: 10, gap: 4 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pattern: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
});
