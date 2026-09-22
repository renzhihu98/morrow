import { formatLocalTime, type Source } from '@morrow/core';
import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { formatCount } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { ink } from '@/theme/ink';
import { sansStyle, serifStyle } from '@/theme/typography';
import { Dot } from './Dot';
import { Txt } from './Txt';

/** A meta fragment: `mono` segments are numerals (Geist Mono), the rest Geist (SPEC §4.D). */
type Seg = { text: string; mono?: boolean };

function metaSegments(source: Source, timeZone: string): Seg[][] {
  if (source.status === 'error') return [[{ text: 'Needs attention' }]];
  if (source.status !== 'linked') return [[{ text: 'Not linked' }]];
  const parts: Seg[][] = [];
  if (source.stat) parts.push([{ text: formatCount(source.stat.value), mono: true }, { text: ` ${source.stat.label}` }]);
  else if (source.watchingCount > 0)
    parts.push([
      { text: 'Watching ' },
      { text: String(source.watchingCount), mono: true },
      { text: source.watchingCount === 1 ? ' prophecy' : ' prophecies' },
    ]);
  if (source.lastSyncedAt) parts.push([{ text: 'synced ' }, { text: formatLocalTime(source.lastSyncedAt, timeZone), mono: true }]);
  return parts.length ? parts : [[{ text: 'Linked' }]];
}

function MetaLine({ parts }: { parts: Seg[][] }) {
  return (
    <Txt variant="label" color="textMuted">
      {parts.map((segs, i) => (
        <Fragment key={i}>
          {i > 0 ? ' · ' : ''}
          {segs.map((s, j) =>
            s.mono ? (
              <Txt key={j} variant="meta" color="textMuted">
                {s.text}
              </Txt>
            ) : (
              s.text
            ),
          )}
        </Fragment>
      ))}
    </Txt>
  );
}

/**
 * Sources account row (v4 screen 12, Paper BKL). Linked: serif name, Chartreuse dot + "Linked",
 * meta, what it reads, Disconnect. Not linked: a dashed tile with an Oxblood "Connect" pill.
 * No letter tiles (SPEC §4.E).
 */
export function SourceRow({
  source,
  timeZone,
  onConnect,
  connecting,
  onDisconnect,
  disconnecting,
}: {
  source: Source;
  timeZone: string;
  onConnect?: () => void;
  connecting?: boolean;
  /** Linked sources that can be unlinked (Calendar, Spotify, Mail). */
  onDisconnect?: () => void;
  disconnecting?: boolean;
}) {
  const { palette } = useTheme();
  const linked = source.status === 'linked';
  const meta = <MetaLine parts={metaSegments(source, timeZone)} />;

  if (!linked) {
    return (
      <View style={[styles.tile, { borderColor: ink.dashed }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt color="textMuted" style={serifStyle(24, 28, -0.01)}>
            {source.name}
          </Txt>
          {meta}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${source.status === 'error' ? 'Reconnect' : 'Connect'} ${source.name}`}
          onPress={onConnect}
          disabled={connecting}
          style={({ pressed }) => [styles.connect, { backgroundColor: palette.accent, opacity: pressed || connecting ? 0.7 : 1 }]}
        >
          <Txt color="onAccent" style={sansStyle(15, 20, true)}>
            {connecting ? 'Opening…' : source.status === 'error' ? 'Reconnect' : 'Connect'}
          </Txt>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.row, { borderTopColor: palette.hairline }]}>
      <View style={styles.top}>
        <Txt style={serifStyle(24, 28, -0.01)}>{source.name}</Txt>
        <View style={styles.status} accessible accessibilityLabel={`${source.name} linked`}>
          <Dot color={palette.highlight} />
          <Txt variant="label" color="textMuted">
            Linked
          </Txt>
        </View>
      </View>
      {meta}
      <Txt style={{ paddingTop: 6 }}>{source.reads}</Txt>
      {onDisconnect ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Disconnect ${source.name}`}
          onPress={onDisconnect}
          disabled={disconnecting}
          hitSlop={8}
          style={{ alignSelf: 'flex-start', marginTop: 8 }}
        >
          <Txt variant="label" color="textMuted" style={{ fontSize: 13, lineHeight: 18 }}>
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 18, borderTopWidth: 1, gap: 2 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginVertical: 12,
  },
  connect: { borderRadius: 20, paddingVertical: 9, paddingHorizontal: 18, flexShrink: 0 },
});
