import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { ConfirmInput } from '@/components/ConfirmInput';
import { Header } from '@/components/Header';
import { Txt } from '@/components/Txt';
import { setDemoMode } from '@/data/api';
import { resetDemoEdits, useDemoMode, useForgetEverything, useProphecies, useReadings, useSources } from '@/data/queries';
import { formatBytes, isForgetConfirmed } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { monoStyle, sansStyle } from '@/theme/typography';

/** A deleted-item label with any count in Geist Mono, e.g. `Prophecies, 3 still open`. */
function RowLabel({ parts }: { parts: (string | number)[] }) {
  return (
    <Txt style={sansStyle(15, 22)}>
      {parts.map((p, i) =>
        typeof p === 'number' ? (
          <Txt key={i} style={monoStyle(14, 22)}>
            {String(p)}
          </Txt>
        ) : (
          p
        ),
      )}
    </Txt>
  );
}

/** v4 screen 14 — forget everything (Paper B4T): type FORGET, Brick button, then a goodbye state. No illustration. */
export default function ForgetScreen() {
  const { palette } = useTheme();
  const qc = useQueryClient();
  const readings = useReadings();
  const prophecies = useProphecies();
  const sources = useSources();
  const demo = useDemoMode();
  const forget = useForgetEverything();
  const [value, setValue] = useState('');
  const [gone, setGone] = useState(false);

  const confirmed = isForgetConfirmed(value);
  const openCount = prophecies.data?.open.length ?? 0;
  const madeCount = prophecies.data ? prophecies.data.open.length + prophecies.data.resolved.length : null;
  const linked = sources.data?.sources.filter((s) => s.status === 'linked').length ?? null;

  const rows: { key: string; label: (string | number)[]; value: string }[] = [
    { key: 'readings', label: ['Readings and transcripts'], value: readings.data ? String(readings.data.total) : '—' },
    {
      key: 'prophecies',
      label: prophecies.data ? ['Prophecies, ', openCount, ' still open'] : ['Prophecies'],
      value: madeCount !== null ? String(madeCount) : '—',
    },
    { key: 'dossier', label: ['Your dossier'], value: sources.data ? formatBytes(sources.data.dossier.sizeBytes) : '—' },
    { key: 'sources', label: ['Source connections'], value: linked !== null ? String(linked) : '—' },
  ];

  const onForget = () => {
    if (!confirmed) return;
    forget.mutate(undefined, { onSuccess: () => setGone(true) });
  };

  const startOver = () => {
    resetDemoEdits();
    if (demo) setDemoMode(true);
    qc.clear();
    router.dismissAll();
    router.replace('/');
  };

  const keep = () => (router.canGoBack() ? router.back() : router.replace('/sources'));

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.root, { backgroundColor: palette.bg }]}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Header active="sources" />
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {gone ? (
            <View style={{ gap: 16 }} accessibilityLiveRegion="polite">
              <Txt variant="confirm" accessibilityRole="header">
                Morrow has let you go.
              </Txt>
              <Txt color="textMuted">Every source is disconnected. Your readings, prophecies and dossier are gone.</Txt>
              <Button
                variant="secondary"
                label={demo ? 'Start the demo over' : 'Start over'}
                onPress={startOver}
                style={{ marginTop: 16 }}
              />
            </View>
          ) : (
            <>
              <View style={{ gap: 16 }}>
                <Txt variant="confirm" accessibilityRole="header">
                  Let Morrow forget you?
                </Txt>
                <Txt color="textMuted">
                  This can't be undone. Every source will be disconnected, and Morrow will permanently delete:
                </Txt>
              </View>

              <View style={[styles.list, { backgroundColor: palette.surface, borderColor: palette.hairline }]}>
                {rows.map((row, i) => (
                  <View
                    key={row.key}
                    style={[styles.listRow, i > 0 && { borderTopWidth: 1, borderTopColor: palette.hairline }]}
                    accessible
                  >
                    <RowLabel parts={row.label} />
                    <Txt variant="meta" color="textMuted">
                      {row.value}
                    </Txt>
                  </View>
                ))}
              </View>

              <View style={{ paddingTop: 24 }}>
                <ConfirmInput value={value} onChangeText={setValue} />
              </View>

              <View style={styles.actions}>
                <Button
                  variant="danger"
                  label="Forget everything"
                  disabled={!confirmed}
                  loading={forget.isPending}
                  onPress={onForget}
                  accessibilityLabel={confirmed ? 'Forget everything' : 'Forget everything. Type FORGET to enable.'}
                />
                <Button variant="secondary" label="Keep everything" onPress={keep} />
              </View>
              {forget.isError ? (
                <Txt variant="label" color="danger" style={{ textAlign: 'center', paddingTop: 12 }}>
                  Morrow couldn't forget yet. Try again.
                </Txt>
              ) : null}
              <Button
                variant="link"
                label="Download a copy first"
                onPress={() => router.push('/sources/dossier')}
                style={{ marginTop: 20 }}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: 24, paddingBottom: 40, paddingTop: 48 },
  list: { marginTop: 24, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16 },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, gap: 12 },
  actions: { paddingTop: 20, gap: 12 },
});
