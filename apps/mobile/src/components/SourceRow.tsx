import { formatLocalTime, type Source } from '@morrow/core';
import { Pressable, StyleSheet, View } from 'react-native';
import { formatCount, sourceGlyph } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { monoStyle, sansStyle, serifStyle } from '@/theme/typography';
import { Dot } from './Dot';
import { Txt } from './Txt';

function metaLine(source: Source, timeZone: string): string {
  if (source.status !== 'linked') return source.status === 'error' ? 'NEEDS ATTENTION' : 'NOT LINKED';
  const sync = source.lastSyncedAt ? `SYNC ${formatLocalTime(source.lastSyncedAt, timeZone)}` : null;
  if (source.stat) return [`${formatCount(source.stat.value)} ${source.stat.label.toUpperCase()}`, sync].filter(Boolean).join(' · ');
  if (source.watchingCount > 0) return `WATCHING ${source.watchingCount} ${source.watchingCount === 1 ? 'PROPHECY' : 'PROPHECIES'}`;
  return sync ?? 'LINKED';
}

/** Sources list row (10): glyph box, serif name, mono meta, what it reads, status / Connect. */
export function SourceRow({
  source,
  timeZone,
  onConnect,
  connecting,
}: {
  source: Source;
  timeZone: string;
  onConnect?: () => void;
  connecting?: boolean;
}) {
  const { palette } = useTheme();
  const linked = source.status === 'linked';
  return (
    <View style={[styles.row, { borderTopColor: palette.hairline }]}>
      <View
        style={[
          styles.glyph,
          { borderColor: palette.hairlineStrong },
          !linked && { borderStyle: 'dashed' },
        ]}
      >
        <Txt color={linked ? 'textPrimary' : 'textFaint'} style={monoStyle(11, 14, 0)}>
          {sourceGlyph(source.kind)}
        </Txt>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.top}>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt color={linked ? 'textPrimary' : 'textMuted'} style={serifStyle(22, 26)}>
              {source.name}
            </Txt>
            <Txt variant="label" color="textMuted" style={{ fontSize: 10, lineHeight: 13 }}>
              {metaLine(source, timeZone)}
            </Txt>
          </View>
          {linked ? (
            <View style={styles.status}>
              <Dot color={palette.accent} size={7} />
              <Txt variant="label" color="accent">LINKED</Txt>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Connect ${source.name}`}
              onPress={onConnect}
              disabled={connecting}
              style={({ pressed }) => [styles.connect, { backgroundColor: palette.accentFill, opacity: pressed || connecting ? 0.7 : 1 }]}
            >
              <Txt color="onAccent" style={sansStyle(14, 20, true)}>
                {connecting ? 'Opening…' : 'Connect'}
              </Txt>
            </Pressable>
          )}
        </View>
        {linked ? (
          <Txt color="textSecondary" style={[sansStyle(14, 21), { marginTop: 10 }]}>
            {source.reads}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, paddingVertical: 16, borderTopWidth: 1 },
  glyph: { width: 36, height: 36, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginTop: 6 },
  connect: { height: 30, paddingHorizontal: 12, borderRadius: 8, justifyContent: 'center' },
});
