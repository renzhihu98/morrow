import { type Prophecy } from '@morrow/core';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Dot } from '@/components/Dot';
import { Page, PageState, PageTitle } from '@/components/Page';
import { ProphecyCard, RecordMarks, StatusMark } from '@/components/Reading';
import { Txt } from '@/components/Txt';
import { useProphecies, useToday } from '@/data/queries';
import { pad2, shortDateOf } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { serifStyle } from '@/theme/typography';

const VISIBLE_OPEN = 2;

/** Screen 09 — open prophecies being watched + resolved record. */
export default function PropheciesScreen() {
  const q = useProphecies();
  const today = useToday();
  const { palette } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const tz = today.data?.user.timezone ?? 'UTC';
  const now = useMemo(() => new Date(today.data?.now ?? Date.now()), [today.data?.now]);

  const data = q.data;
  const open = data ? [...data.open].sort((a, b) => Date.parse(a.windowEnd) - Date.parse(b.windowEnd)) : [];
  const shown = expanded ? open : open.slice(0, VISIBLE_OPEN);
  const hidden = open.length - shown.length;
  const resolved = data
    ? [...data.resolved].sort((a, b) => Date.parse(b.resolvedAt ?? b.windowEnd) - Date.parse(a.resolvedAt ?? a.windowEnd))
    : [];
  const made = data ? data.open.length + data.resolved.length : null;

  return (
    <Page active="prophecies" refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <PageTitle eyebrow={`PROPHECIES / ${made ?? '—'} MADE`} title="Prophecies">
        {data ? <RecordMarks record={data.record} /> : null}
      </PageTitle>
      {!data ? (
        <PageState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <>
          <View style={[styles.row, { marginTop: 6, marginBottom: 12 }]}>
            <Dot color={palette.accent} size={7} />
            <Txt variant="label" color="accent">{`WATCHING / ${pad2(open.length)} OPEN`}</Txt>
          </View>
          <View style={{ gap: 12 }}>
            {shown.map((p) => (
              <ProphecyCard key={p.id} prophecy={p} now={now} timeZone={tz} />
            ))}
          </View>
          {hidden > 0 || expanded ? (
            <Pressable accessibilityRole="button" onPress={() => setExpanded((e) => !e)} hitSlop={8} style={{ paddingTop: 16 }}>
              <Txt variant="label" color="textMuted">
                {expanded ? '− SHOW FEWER' : `+ ${hidden} MORE OPEN`}
              </Txt>
            </Pressable>
          ) : null}

          <Txt variant="label" color="textMuted" style={{ marginTop: 28, marginBottom: 12 }}>
            {`RESOLVED / ${pad2(data.resolved.length)}`}
          </Txt>
          <View style={{ borderBottomWidth: 1, borderBottomColor: palette.hairline }}>
            {resolved.map((p) => (
              <ResolvedRow key={p.id} prophecy={p} timeZone={tz} />
            ))}
          </View>
        </>
      )}
    </Page>
  );
}

function ResolvedRow({ prophecy, timeZone }: { prophecy: Prophecy; timeZone: string }) {
  const { palette } = useTheme();
  const fulfilled = prophecy.status === 'fulfilled';
  const date = prophecy.resolvedAt ? shortDateOf(prophecy.resolvedAt, timeZone) : '—';
  return (
    <View
      style={[styles.resolved, { borderTopColor: palette.hairline }]}
      accessible
      accessibilityLabel={`${prophecy.title} ${fulfilled ? 'Fulfilled' : 'Expired'} ${date}`}
    >
      <Txt color={fulfilled ? 'textPrimary' : 'textMuted'} style={[serifStyle(19, 24, -0.01), { flex: 1 }]}>
        {prophecy.title}
      </Txt>
      <View style={styles.row}>
        <StatusMark status={prophecy.status} />
        <Txt variant="label" color={fulfilled ? 'accent' : 'textMuted'} style={{ letterSpacing: 0 }}>
          {date}
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resolved: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14, borderTopWidth: 1 },
});
