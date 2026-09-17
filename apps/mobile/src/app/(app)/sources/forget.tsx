import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConfirmInput } from '@/components/ConfirmInput';
import { Header } from '@/components/Header';
import { FadingOrbit } from '@/components/Orbit';
import { Txt } from '@/components/Txt';
import { setDemoMode } from '@/data/api';
import { resetDemoEdits, useDemoMode, useForgetEverything, useProphecies, useReadings, useSources } from '@/data/queries';
import { formatBytes, isForgetConfirmed } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { monoStyle, sansStyle } from '@/theme/typography';

/** Screen 12 — forget everything (type FORGET), then a goodbye state. */
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
  const madeCount = prophecies.data ? prophecies.data.open.length + prophecies.data.resolved.length : 0;
  const linked = sources.data?.sources.filter((s) => s.status === 'linked').length ?? 0;

  const rows: [string, string][] = [
    ['Readings and transcripts', String(readings.data?.total ?? '—')],
    [`Prophecies, ${openCount} still open`, String(madeCount)],
    ['Your dossier', sources.data ? formatBytes(sources.data.dossier.sizeBytes) : '—'],
    ['Source connections', String(linked)],
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

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.root, { backgroundColor: palette.bg }]}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Header active="sources" />
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.center}>
            <FadingOrbit size={gone ? 96 : 76} />
          </View>
          {gone ? (
            <View style={[styles.center, { gap: 14, paddingTop: 24 }]} accessibilityLiveRegion="polite">
              <Txt variant="confirm" style={styles.centerText} accessibilityRole="header">
                Morrow has let you go.
              </Txt>
              <Txt color="textSecondary" style={styles.centerText}>
                Every source is disconnected. Your readings, prophecies and dossier are gone.
              </Txt>
              <Pressable
                accessibilityRole="button"
                onPress={startOver}
                style={({ pressed }) => [styles.secondary, { borderColor: palette.hairlineStrong, opacity: pressed ? 0.7 : 1, alignSelf: 'stretch', marginTop: 24 }]}
              >
                <Txt style={sansStyle(15, 22, true)}>{demo ? 'Start the demo over' : 'Start over'}</Txt>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={[styles.center, { gap: 14, paddingTop: 18 }]}>
                <Txt variant="confirm" style={styles.centerText} accessibilityRole="header">
                  Let Morrow forget you?
                </Txt>
                <Txt color="textSecondary" style={styles.centerText}>
                  This can't be undone. Every source will be disconnected, and Morrow will permanently delete:
                </Txt>
              </View>

              <View style={[styles.list, { backgroundColor: palette.panel, borderColor: palette.hairline }]}>
                {rows.map(([label, value], i) => (
                  <View key={label} style={[styles.listRow, i > 0 && { borderTopWidth: 1, borderTopColor: palette.hairline }]}>
                    <Txt style={sansStyle(14, 20)}>{label}</Txt>
                    <Txt color="textMuted" style={monoStyle(11, 14, 0)}>
                      {value}
                    </Txt>
                  </View>
                ))}
              </View>

              <View style={{ paddingTop: 20 }}>
                <ConfirmInput value={value} onChangeText={setValue} />
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !confirmed || forget.isPending }}
                disabled={!confirmed || forget.isPending}
                onPress={onForget}
                style={({ pressed }) => [
                  styles.danger,
                  confirmed
                    ? { backgroundColor: palette.danger, opacity: pressed || forget.isPending ? 0.8 : 1 }
                    : { backgroundColor: 'transparent', borderWidth: 1, borderColor: palette.hairline },
                ]}
              >
                <Txt color={confirmed ? 'onDanger' : 'textFaint'} style={sansStyle(15, 22, true)}>
                  {forget.isPending ? 'Forgetting…' : 'Forget everything'}
                </Txt>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/sources'))}
                style={({ pressed }) => [styles.secondary, { borderColor: palette.hairlineStrong, opacity: pressed ? 0.7 : 1 }]}
              >
                <Txt style={sansStyle(15, 22, true)}>Keep everything</Txt>
              </Pressable>
              {forget.isError ? (
                <Txt variant="label" color="danger" style={[styles.centerText, { paddingTop: 12 }]}>
                  Morrow couldn't forget yet. Try again.
                </Txt>
              ) : null}
              <Pressable accessibilityRole="link" onPress={() => router.push('/sources/dossier')} style={{ paddingTop: 20 }}>
                <Txt color="textMuted" style={[sansStyle(14, 20), styles.centerText, { textDecorationLine: 'underline' }]}>
                  Download a copy first
                </Txt>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 12 },
  center: { alignItems: 'center', paddingHorizontal: 8 },
  centerText: { textAlign: 'center' },
  list: { marginTop: 20, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16 },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  danger: { marginTop: 16, height: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  secondary: { marginTop: 8, height: 46, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
