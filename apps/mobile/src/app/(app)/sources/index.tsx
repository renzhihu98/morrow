import type { SourceKind } from '@morrow/core';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Hairline, Page, PageState, PageTitle } from '@/components/Page';
import { SourceRow } from '@/components/SourceRow';
import { Txt } from '@/components/Txt';
import { isLinkable } from '@/data/auth';
import { useDisconnectSource, useLinkSource, useSources, useToday } from '@/data/queries';
import { useTheme } from '@/theme/ThemeProvider';
import { sansStyle } from '@/theme/typography';

/** Screen 10 — connected sources. */
export default function SourcesScreen() {
  const q = useSources();
  const today = useToday();
  const link = useLinkSource('/sources');
  const disconnect = useDisconnectSource();
  const { palette } = useTheme();
  const [notice, setNotice] = useState<string | null>(null);
  const tz = today.data?.user.timezone ?? 'UTC';

  const onConnect = (kind: SourceKind) => {
    setNotice(null);
    link.mutate(kind, {
      onSuccess: (res) => setNotice(res.notice),
      onError: () => setNotice("Couldn't finish connecting. Try again."),
    });
  };

  const onDisconnect = (kind: SourceKind, name: string) => {
    Alert.alert(
      `Disconnect ${name}?`,
      'Morrow unlinks the account, deletes its raw events and rebuilds your dossier without it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => {
            setNotice(null);
            disconnect.mutate(kind, { onError: () => setNotice(`Couldn't disconnect ${name}. Try again.`) });
          },
        },
      ],
    );
  };

  return (
    <Page active="sources" refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <PageTitle title="Sources" />
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
                connecting={link.isPending && link.variables === s.kind}
                onDisconnect={isLinkable(s.kind) ? () => onDisconnect(s.kind, s.name) : undefined}
                disconnecting={disconnect.isPending && disconnect.variables === s.kind}
              />
            ))}
            <Hairline />
          </View>
          {notice ? (
            <Txt variant="label" color="textMuted" style={{ paddingTop: 12 }}>
              {notice}
            </Txt>
          ) : null}

          <View style={styles.facts}>
            <View style={styles.between}>
              <Txt variant="label" color="textMuted">Raw events kept</Txt>
              <Txt variant="label">24 hours</Txt>
            </View>
            <View style={styles.between}>
              <Txt variant="label" color="textMuted">Never read</Txt>
              <Txt variant="label">Health · money</Txt>
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
