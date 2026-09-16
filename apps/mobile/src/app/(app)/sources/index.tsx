import type { SourceKind } from '@morrow/core';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Hairline, Page, PageState, PageTitle } from '@/components/Page';
import { SourceRow } from '@/components/SourceRow';
import { Txt } from '@/components/Txt';
import { useConnectSource, useSources, useToday } from '@/data/queries';
import { useTheme } from '@/theme/ThemeProvider';
import { sansStyle } from '@/theme/typography';

/** Screen 10 — connected sources. */
export default function SourcesScreen() {
  const q = useSources();
  const today = useToday();
  const connect = useConnectSource();
  const { palette } = useTheme();
  const [notice, setNotice] = useState<string | null>(null);
  const tz = today.data?.user.timezone ?? 'UTC';

  const linked = q.data?.sources.filter((s) => s.status === 'linked').length;

  const onConnect = (kind: SourceKind) => {
    setNotice(null);
    connect.mutate(kind, {
      onSuccess: (res) => {
        if (res.authorizeUrl) void Linking.openURL(res.authorizeUrl);
        else setNotice('Morrow will ask for this source when a prophecy needs it.');
      },
      onError: () => setNotice("Couldn't start the connection. Try again."),
    });
  };

  return (
    <Page active="sources" refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <PageTitle eyebrow={`SOURCES / ${linked ?? '—'} LINKED`} title="Sources" />
      {!q.data ? (
        <PageState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <>
          <View>
            {q.data.sources.map((s) => (
              <SourceRow
                key={s.kind}
                source={s}
                timeZone={tz}
                onConnect={() => onConnect(s.kind)}
                connecting={connect.isPending && connect.variables === s.kind}
              />
            ))}
            <Hairline />
          </View>
          {notice ? (
            <Txt variant="label" color="textMuted" upper={false} style={{ paddingTop: 12 }}>
              {notice}
            </Txt>
          ) : null}

          <View style={styles.facts}>
            <View style={styles.between}>
              <Txt variant="label" color="textMuted">RAW EVENTS KEPT</Txt>
              <Txt variant="label">24 HOURS</Txt>
            </View>
            <View style={styles.between}>
              <Txt variant="label" color="textMuted">NEVER READ</Txt>
              <Txt variant="label">HEALTH · MONEY</Txt>
            </View>
          </View>

          <View style={styles.links}>
            <Link href="/sources/dossier" accessibilityRole="link">
              <Txt style={[sansStyle(15, 22), { textDecorationLine: 'underline', textDecorationColor: palette.textPrimary }]}>
                View dossier
              </Txt>
            </Link>
            <Link href="/sources/forget" accessibilityRole="link">
              <Txt color="textMuted" style={sansStyle(15, 22)}>
                Forget everything
              </Txt>
            </Link>
          </View>

          <Txt color="textMuted" style={[sansStyle(14, 21), { paddingTop: 36 }]}>
            Morrow never connects anything on its own. It will ask only when a prophecy needs to see more.
          </Txt>
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  facts: { paddingTop: 22, gap: 10 },
  between: { flexDirection: 'row', justifyContent: 'space-between' },
  links: { flexDirection: 'row', gap: 22, paddingTop: 22 },
});
