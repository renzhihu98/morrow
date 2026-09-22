import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { clamp01 } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { ink } from '@/theme/ink';
import { Dot } from './Dot';
import { MoonGlyph, type MoonStatus } from './MoonGlyph';
import { Txt } from './Txt';

/** Oxblood fill on a faint ink track, 3pt tall (Paper). */
export function LikelihoodBar({ value }: { value: number }) {
  const { palette } = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: ink.track }]} accessible={false}>
      <View style={[styles.fill, { backgroundColor: palette.accent, width: `${Math.round(clamp01(value) * 100)}%` }]} />
    </View>
  );
}

type Props = {
  statement: string;
  likelihood: number;
  /** Mono window, e.g. "Until 10.07", "From 09.26", "09.16 → 10.07". */
  window?: string;
  /**
   * `inline` (default, inside a Morrow message — Paper BQQ): "Prophecy" label, window + moon on the right,
   * "Likelihood" bar row. `list` (open cards on Prophecies — Paper AZD): moon + window on the left, optional badge.
   */
  variant?: 'inline' | 'list';
  /** List only: status pill on the right, e.g. "Closes in 3 days" (`accent`) or "Until 10.19" (`outline`). */
  badge?: { label: string; tone?: 'accent' | 'outline' };
  /** Optional closing line under the bar, e.g. "I'll tell you when it lands." */
  footer?: string;
  /** Shows a Chartreuse "Landed" row with this mono date (Prophecy fulfilled). */
  landedAt?: string;
  style?: StyleProp<ViewStyle>;
};

/** Prophecy card (SPEC §4.F): `surface` + hairline, radius 16 (Paper mobile), serif statement, likelihood bar. */
export function ProphecyCard({ statement, likelihood, window, variant = 'inline', badge, footer, landedAt, style }: Props) {
  const { palette } = useTheme();
  const l = clamp01(likelihood);
  const value = l.toFixed(2);
  const list = variant === 'list';
  const status: MoonStatus = landedAt ? 'fulfilled' : 'open';

  return (
    <View
      style={[list ? styles.cardList : styles.cardInline, { backgroundColor: palette.surface, borderColor: palette.hairline }, style]}
      accessible
      accessibilityLabel={`Prophecy${window ? `, ${window}` : ''}: ${statement}. Likelihood ${value}.${landedAt ? ` Landed ${landedAt}.` : ''}`}
    >
      {list ? (
        <View style={styles.header}>
          <MoonGlyph likelihood={l} status={status} size={16} />
          <Txt variant="meta" color="textMuted" style={styles.grow}>
            {window}
          </Txt>
          {badge && (
            <View
              style={[
                styles.badge,
                badge.tone === 'outline'
                  ? { borderWidth: 1, borderColor: palette.hairline }
                  : { backgroundColor: palette.accent },
              ]}
            >
              <Txt variant="label" color={badge.tone === 'outline' ? 'textMuted' : 'onAccent'}>
                {badge.label}
              </Txt>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.header}>
          <Txt variant="label" medium color="accent" style={styles.grow}>
            Prophecy
          </Txt>
          {window ? (
            <Txt variant="meta" color="textMuted">
              {window}
            </Txt>
          ) : null}
          <MoonGlyph likelihood={l} status={status} size={16} />
        </View>
      )}

      <Txt variant="prophecy" style={list ? styles.statementList : styles.statementInline}>
        {statement}
      </Txt>

      <View style={[styles.barRow, list && { paddingTop: 2 }]}>
        {!list && (
          <Txt variant="label" color="textMuted">
            Likelihood
          </Txt>
        )}
        <LikelihoodBar value={l} />
        <Txt variant="meta" style={styles.value}>
          {value}
        </Txt>
      </View>

      {landedAt ? (
        <View style={styles.landed}>
          <Dot color={palette.highlight} />
          <Txt variant="label" color="textMuted">
            Landed
          </Txt>
          <Txt variant="meta" color="textMuted">
            {landedAt}
          </Txt>
        </View>
      ) : null}

      {footer ? (
        <Txt variant="label" color="textMuted">
          {footer}
        </Txt>
      ) : null}
    </View>
  );
}

type RowProps = {
  statement: string;
  status: MoonStatus;
  /** Right-hand meta: a mono date ("09.30") or a sentence-case label ("Missed"). */
  meta?: string;
  /** Render `meta` in Geist instead of Geist Mono (use for words; mono is for numerals). */
  metaIsLabel?: boolean;
  likelihood?: number;
  /** Omit the top hairline (first row under a section label that already has one). */
  first?: boolean;
};

/** Resolved-list row (Paper AZD "Resolved"): hairline-divided serif statement, moon + meta on the right. Expired rows mute the statement. */
export function ProphecyRow({ statement, status, meta, metaIsLabel = false, likelihood, first = false }: RowProps) {
  const { palette } = useTheme();
  return (
    <View style={[styles.row, !first && { borderTopWidth: 1, borderTopColor: palette.hairline }]} accessible>
      <Txt variant="row" color={status === 'expired' ? 'textMuted' : 'text'} style={styles.grow}>
        {statement}
      </Txt>
      <View style={styles.rowMeta}>
        <MoonGlyph status={status} likelihood={likelihood} size={12} />
        {meta ? (
          <Txt variant={metaIsLabel ? 'label' : 'meta'} color="textMuted">
            {meta}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardInline: { borderWidth: 1, borderRadius: 16, paddingTop: 16, paddingHorizontal: 20, paddingBottom: 18, gap: 14 },
  cardList: { borderWidth: 1, borderRadius: 16, paddingTop: 18, paddingHorizontal: 20, paddingBottom: 20, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  grow: { flex: 1 },
  badge: { borderRadius: 12, paddingVertical: 4, paddingHorizontal: 10 },
  statementInline: { fontSize: 22, lineHeight: 28 },
  statementList: { fontSize: 21, lineHeight: 28 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  track: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 3, borderRadius: 2 },
  value: { fontSize: 13, lineHeight: 16 },
  landed: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
});
