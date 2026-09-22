import type { SourceKind } from '@morrow/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { Hairline, Page, PageState } from '@/components/Page';
import { SourceRow } from '@/components/SourceRow';
import { Txt } from '@/components/Txt';
import { isLinkable } from '@/data/auth';
import { useDisconnectSource, useLinkSource, useSources, useToday } from '@/data/queries';
import { monoStyle, sansStyle } from '@/theme/typography';

/** v4 screen 12 — Sources, an account screen (Paper BKL). */
export default function SourcesScreen() {
  const q = useSources();
  const today = useToday();
  const link = useLinkSource('/sources');
  const disconnect = useDisconnectSource();
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

  const all = q.data?.sources ?? [];
  const linked = all.filter((s) => s.status === 'linked');
  const unlinked = all.filter((s) => s.status !== 'linked');

  return (
    <Page active="sources" refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <View style={styles.titleBlock}>
        <Txt variant="title" accessibilityRole="header">
          Sources
        </Txt>
      </View>
      {!q.data ? (
        <PageState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <>
          <View>
            {linked.map((s) => (
              <SourceRow
                key={s.kind}
                source={s}
                timeZone={tz}
                onDisconnect={isLinkable(s.kind) ? () => onDisconnect(s.kind, s.name) : undefined}
                disconnecting={disconnect.isPending && disconnect.variables === s.kind}
              />
            ))}
            {linked.length > 0 ? <Hairline /> : null}
            {unlinked.map((s) => (
              <SourceRow
                key={s.kind}
                source={s}
                timeZone={tz}
                onConnect={() => onConnect(s.kind)}
                connecting={link.isPending && link.variables === s.kind}
              />
            ))}
          </View>
          {notice ? (
            <Txt variant="label" color="textMuted" style={{ paddingTop: 12 }}>
              {notice}
            </Txt>
          ) : null}

          <View style={styles.facts}>
            <View style={styles.between}>
              <Txt color="textMuted" style={sansStyle(14, 20)}>
                Raw events kept
              </Txt>
              <Txt style={sansStyle(13, 16)}>
                <Txt variant="meta" style={monoStyle(13, 16)}>
                  24
                </Txt>
                {' hours'}
              </Txt>
            </View>
            <View style={styles.between}>
              <Txt color="textMuted" style={sansStyle(14, 20)}>
                Never read
              </Txt>
              <Txt style={sansStyle(13, 16)}>Health · money</Txt>
            </View>
          </View>

          <View style={styles.links}>
            <Button variant="link" label="View dossier" onPress={() => router.push('/sources/dossier')} style={styles.link} />
            <Button
              variant="dangerLink"
              label="Forget everything"
              onPress={() => router.push('/sources/forget')}
              style={styles.link}
            />
          </View>

          <Txt color="textMuted" style={{ paddingTop: 28 }}>
            Morrow never connects anything on its own. It will ask only when a prophecy needs to see more.
          </Txt>
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  titleBlock: { paddingTop: 28, paddingBottom: 20 },
  facts: { paddingTop: 20, gap: 10 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  links: { flexDirection: 'row', gap: 24, paddingTop: 24 },
  link: { alignSelf: 'flex-start' },
});
