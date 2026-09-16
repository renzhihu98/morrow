import { QUESTION_LIMIT } from '@morrow/core';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Dot } from '@/components/Dot';
import { Header, type NavSection } from '@/components/Header';
import { ProgressTrack } from '@/components/Reading';
import { Txt } from '@/components/Txt';
import { useQuestionsUsed } from '@/data/chat';
import { useProphecies, useReadings, useSources, useToday } from '@/data/queries';
import { pad2 } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { em, sansStyle, serifStyle } from '@/theme/typography';

type Item = { key: NavSection; label: string; href: Href; status: string; live?: boolean };

const THEME_LABEL = { system: 'SYSTEM', dark: 'DARK', light: 'LIGHT' } as const;

/** Screen 08 — full-screen menu sheet. */
export default function MenuScreen() {
  const { palette, preference, cyclePreference } = useTheme();
  const params = useLocalSearchParams<{ active?: string }>();
  const active = (params.active ?? 'today') as NavSection;

  const today = useToday();
  const readings = useReadings();
  const prophecies = useProphecies();
  const sources = useSources();

  const reading = today.data?.reading;
  const used = useQuestionsUsed(reading?.id, reading?.questionCount ?? 0);
  const limit = today.data?.questionLimit ?? QUESTION_LIMIT;
  const pastCount = readings.data ? readings.data.total : null;
  const openCount = prophecies.data?.open.length ?? null;
  const linked = sources.data?.sources.filter((s) => s.status === 'linked').length ?? null;

  const items: Item[] = [
    { key: 'today', label: 'Today', href: '/', status: reading ? (reading.status === 'open' ? 'OPEN' : 'SEALED') : '—', live: reading?.status === 'open' },
    { key: 'readings', label: 'Readings', href: '/readings', status: pastCount !== null ? `${pastCount} PAST` : '—' },
    { key: 'prophecies', label: 'Prophecies', href: '/prophecies', status: openCount !== null ? `${pad2(openCount)} OPEN` : '—' },
    { key: 'sources', label: 'Sources', href: '/sources', status: linked !== null ? `${linked} LINKED` : '—' },
  ];

  const go = (href: Href) => {
    router.back();
    router.navigate(href);
  };

  const name = today.data?.user.name ?? '—';

  // Full-screen modals can report zero insets on iOS; fall back to the window's metrics.
  const insets = useSafeAreaInsets();
  const top = Math.max(insets.top, initialWindowMetrics?.insets.top ?? 0);
  const bottom = Math.max(insets.bottom, initialWindowMetrics?.insets.bottom ?? 0);

  return (
    <View style={[styles.root, { backgroundColor: palette.bg, paddingTop: top, paddingBottom: bottom }]}>
      <Header mode="close" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body} bounces={false}>
        <View style={[styles.nav, { borderBottomColor: palette.hairline }]} accessibilityRole="menu">
          {items.map((item, i) => {
            const isActive = item.key === active;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: isActive }}
                onPress={() => go(item.href)}
                style={({ pressed }) => [styles.navRow, { borderTopColor: palette.hairline, opacity: pressed ? 0.6 : 1 }]}
              >
                <Txt variant="label" color={isActive ? 'accent' : 'textMuted'} style={styles.navNum}>
                  {pad2(i + 1)}
                </Txt>
                <Txt color={isActive ? 'textPrimary' : 'textSecondary'} style={[serifStyle(40, 44, -0.01), { flex: 1 }]}>
                  {item.label}
                </Txt>
                <View style={styles.status}>
                  {item.live ? <Dot color={palette.accent} /> : null}
                  <Txt variant="label" color={item.live ? 'accent' : 'textMuted'}>
                    {item.status}
                  </Txt>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={[styles.card, { backgroundColor: palette.panel, borderColor: palette.hairline }]}>
          <View style={styles.between}>
            <Txt variant="label" color="textMuted">QUESTIONS TODAY</Txt>
            <Txt variant="label" style={{ letterSpacing: 0 }}>{`${used} / ${limit}`}</Txt>
          </View>
          <ProgressTrack value={used / limit} />
          <Txt variant="label" color="textMuted">SEALS AT DAWN · 04:00</Txt>
        </View>
        <View style={styles.account}>
          <View style={[styles.avatar, { borderColor: palette.hairlineStrong }]}>
            <Txt style={serifStyle(17, 20)}>{name.charAt(0)}</Txt>
          </View>
          <Txt style={[sansStyle(15, 22), { flex: 1 }]}>{name}</Txt>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Settings. Theme: ${THEME_LABEL[preference].toLowerCase()}. Tap to change.`}
            onPress={cyclePreference}
            hitSlop={10}
            style={styles.settings}
          >
            <Txt color="textMuted" style={sansStyle(14, 20)}>
              Settings
            </Txt>
            <Txt variant="label" color="textFaint" style={{ fontSize: 10, lineHeight: 12, letterSpacing: em(0.04, 10) }}>
              {`THEME ${THEME_LABEL[preference]}`}
            </Txt>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: 24, paddingTop: 56 },
  nav: { borderBottomWidth: 1 },
  navRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, borderTopWidth: 1 },
  navNum: { width: 36, letterSpacing: 0 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footer: { paddingHorizontal: 24, paddingBottom: 10, gap: 20 },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  account: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  settings: { alignItems: 'flex-end', gap: 2 },
});
