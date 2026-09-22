import { QUESTION_LIMIT } from '@morrow/core';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Dot } from '@/components/Dot';
import { Header, type NavSection } from '@/components/Header';
import { Txt } from '@/components/Txt';
import { signOut } from '@/data/auth';
import { useQuestionsUsed } from '@/data/chat';
import { useDemoMode, useProphecies, useReadings, useToday } from '@/data/queries';
import { exitDemo, useMe } from '@/data/session';
import { useTheme } from '@/theme/ThemeProvider';
import { ink } from '@/theme/ink';
import { monoStyle, sansStyle, serifStyle } from '@/theme/typography';

type Item = { key: NavSection; label: string; href: Href; count?: { n: number; word: string }; live?: boolean };

/** `23 past`: mono numeral + Geist word. */
function Count({ n, word }: { n: number; word: string }) {
  return (
    <Txt variant="label" color="textMuted">
      <Txt variant="meta" color="textMuted">
        {String(n)}
      </Txt>
      {` ${word}`}
    </Txt>
  );
}

/** v4 screen 08 — full-screen menu sheet (Paper CR6). */
export default function MenuScreen() {
  const { palette } = useTheme();
  const params = useLocalSearchParams<{ active?: string }>();
  const active = (params.active ?? 'today') as NavSection;

  const today = useToday();
  const readings = useReadings();
  const prophecies = useProphecies();

  const reading = today.data?.reading;
  const used = useQuestionsUsed(reading?.id, reading?.questionCount ?? 0);
  const limit = today.data?.questionLimit ?? QUESTION_LIMIT;
  const pastCount = readings.data ? readings.data.total : null;
  const openCount = prophecies.data?.open.length ?? null;

  const items: Item[] = [
    { key: 'today', label: 'Today', href: '/', live: reading?.status === 'open' },
    { key: 'readings', label: 'Readings', href: '/readings', count: pastCount !== null ? { n: pastCount, word: 'past' } : undefined },
    {
      key: 'prophecies',
      label: 'Prophecies',
      href: '/prophecies',
      count: openCount !== null ? { n: openCount, word: 'open' } : undefined,
    },
    // No source count here (SPEC §4.A.5): sources only appear on the account screens.
    { key: 'sources', label: 'Sources', href: '/sources' },
  ];

  const go = (href: Href) => {
    router.back();
    router.navigate(href);
  };

  const qc = useQueryClient();
  const me = useMe();
  const demo = useDemoMode();
  const name = me.data?.user.name || today.data?.user.name || '';
  const initial = name ? name.trim().charAt(0).toUpperCase() : '';

  const onSettings = () => {
    Alert.alert(name || 'Settings', undefined, [
      { text: 'Cancel', style: 'cancel' },
      demo
        ? { text: 'Leave demo and sign in', onPress: () => exitDemo(qc) }
        : { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  // Full-screen modals can report zero insets on iOS; fall back to the window's metrics.
  const insets = useSafeAreaInsets();
  const top = Math.max(insets.top, initialWindowMetrics?.insets.top ?? 0);
  const bottom = Math.max(insets.bottom, initialWindowMetrics?.insets.bottom ?? 0);
  const fill = Math.round(Math.min(1, Math.max(0, used / limit)) * 100);

  return (
    <View style={[styles.root, { backgroundColor: palette.bg, paddingTop: top, paddingBottom: bottom }]}>
      <Header mode="close" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body} bounces={false}>
        <View style={[styles.nav, { borderBottomColor: palette.hairline }]} accessibilityRole="menu">
          {items.map((item) => {
            const isActive = item.key === active;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: isActive }}
                onPress={() => go(item.href)}
                style={({ pressed }) => [styles.navRow, { borderTopColor: palette.hairline, opacity: pressed ? 0.6 : 1 }]}
              >
                <Txt color={isActive ? 'accent' : 'text'} style={[serifStyle(44, 48, -0.02), { flex: 1 }]}>
                  {item.label}
                </Txt>
                {item.live ? (
                  <View style={styles.status}>
                    <Dot color={palette.highlight} />
                    <Txt variant="label" color="accent">
                      Open
                    </Txt>
                  </View>
                ) : item.count ? (
                  <Count n={item.count.n} word={item.count.word} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View
          style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.hairline }]}
          accessible
          accessibilityLabel={`Questions today, ${used} of ${limit}. Seals at dawn, 04:00.`}
        >
          <View style={styles.between}>
            <Txt style={sansStyle(14, 20)}>Questions today</Txt>
            <Txt style={monoStyle(13, 16)}>{`${used} / ${limit}`}</Txt>
          </View>
          <View style={[styles.track, { backgroundColor: ink.track }]}>
            <View style={[styles.trackFill, { backgroundColor: palette.accent, width: `${fill}%` }]} />
          </View>
          <Txt variant="label" color="textMuted">
            {'Seals at dawn · '}
            <Txt variant="meta" color="textMuted">
              04:00
            </Txt>
          </Txt>
        </View>
        <View style={styles.account}>
          <View style={[styles.avatar, { borderColor: ink.dashed }]}>
            <Txt style={serifStyle(20, 20)}>{initial}</Txt>
          </View>
          <Txt variant="bodyLg" numberOfLines={1} style={{ flex: 1 }}>
            {name}
          </Txt>
          <Pressable accessibilityRole="button" onPress={onSettings} hitSlop={10}>
            <Txt color="accent" style={sansStyle(15, 22)}>
              Settings
            </Txt>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: 24, paddingTop: 40 },
  nav: { borderBottomWidth: 1 },
  navRow: { flexDirection: 'row', alignItems: 'center', height: 84, borderTopWidth: 1 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  footer: { paddingHorizontal: 24, paddingBottom: 8, gap: 16 },
  card: { borderRadius: 16, borderWidth: 1, paddingVertical: 16, paddingHorizontal: 18, gap: 12 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: 3, borderRadius: 2, overflow: 'hidden' },
  trackFill: { height: 3, borderRadius: 2 },
  account: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 48 },
  avatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
