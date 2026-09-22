import { formatShortDate, type Prophecy } from '@morrow/core';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BodyFigure } from '@/components/BodyFigure';
import { Page, PageState } from '@/components/Page';
import { ProphecyCard, ProphecyRow } from '@/components/ProphecyCard';
import { RecordCounts, RecordStrip } from '@/components/RecordMarks';
import { Txt } from '@/components/Txt';
import { useProphecies, useToday } from '@/data/queries';
import { shortDateOf, windowLabel } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

const VISIBLE_OPEN = 2;

/** `2026-09-26` → `From 09.26`. */
const fromLabel = (p: Prophecy) => `From ${formatShortDate(p.madeOn)}`;

/** v4 screen 11 — open prophecies + resolved record (Paper AZD). */
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

  return (
    <Page active="prophecies" refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Txt variant="title" accessibilityRole="header">
            Prophecies
          </Txt>
          {data ? <RecordCounts record={data.record} /> : null}
        </View>
        <BodyFigure height={136} />
      </View>
      {data ? (
        <View style={{ paddingBottom: 24 }}>
          <RecordStrip marks={data.record.marks} />
        </View>
      ) : null}

      {!data ? (
        <PageState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <>
          {open.length > 0 ? (
            <>
              <View style={styles.sectionLabel}>
                <Txt variant="label" medium color="accent">
                  Open
                </Txt>
              </View>
              <View style={{ gap: 12 }}>
                {shown.map((p) => {
                  const right = windowLabel(p, now, tz);
                  return (
                    <ProphecyCard
                      key={p.id}
                      variant="list"
                      statement={p.statement}
                      likelihood={p.likelihood}
                      window={fromLabel(p)}
                      badge={{ label: right.text, tone: right.urgent ? 'accent' : 'outline' }}
                    />
                  );
                })}
              </View>
              {hidden > 0 || expanded ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setExpanded((e) => !e)}
                  hitSlop={8}
                  style={{ paddingTop: 16, alignSelf: 'flex-start' }}
                >
                  <Txt variant="label" color="accent">
                    {expanded ? '− Show fewer' : `+ ${hidden} more open`}
                  </Txt>
                </Pressable>
              ) : null}
            </>
          ) : (
            <Txt color="textMuted" style={{ paddingTop: 8 }}>
              Nothing open. Morrow makes a new prophecy with each reading.
            </Txt>
          )}

          {resolved.length > 0 ? (
            <>
              <Txt variant="label" color="textMuted" style={{ marginTop: 28, marginBottom: 12 }}>
                {'Resolved · '}
                <Txt variant="meta" color="textMuted">
                  {String(resolved.length)}
                </Txt>
              </Txt>
              <View style={{ borderBottomWidth: 1, borderBottomColor: palette.hairline }}>
                {resolved.map((p) => (
                  <ProphecyRow
                    key={p.id}
                    statement={p.title}
                    status={p.status}
                    likelihood={p.likelihood}
                    meta={p.status === 'fulfilled' && p.resolvedAt ? shortDateOf(p.resolvedAt, tz) : 'Missed'}
                    metaIsLabel={!(p.status === 'fulfilled' && p.resolvedAt)}
                  />
                ))}
              </View>
            </>
          ) : null}
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: 16, paddingBottom: 20, gap: 12 },
  headText: { flex: 1, gap: 16 },
  sectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
});
