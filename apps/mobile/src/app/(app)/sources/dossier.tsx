import { formatLocalTime, type DossierCategory, type DossierFact } from '@morrow/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { DossierRow, PatternRow } from '@/components/DossierRow';
import { Page, PageState } from '@/components/Page';
import { Txt } from '@/components/Txt';
import { useDossier, useForgetFact, useToday } from '@/data/queries';
import { formatBytes } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { monoStyle, sansStyle } from '@/theme/typography';

const CATEGORIES: DossierCategory[] = ['rhythms', 'pursuits', 'people', 'places', 'tastes'];

/** `rhythms` → `Rhythms`. */
const categoryLabel = (c: DossierCategory) => c.charAt(0).toUpperCase() + c.slice(1);

/** Screen 11 — the distilled dossier (readable ↔ raw JSON), forget a single fact. */
export default function DossierScreen() {
  const q = useDossier();
  const today = useToday();
  const forget = useForgetFact();
  const { palette } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const [raw, setRaw] = useState(false);
  const tz = today.data?.user.timezone ?? 'UTC';
  const dossier = q.data?.dossier;

  const backLine = dossier
    ? `← Sources · ${formatBytes(dossier.sizeBytes)} · rebuilt ${formatLocalTime(dossier.rebuiltAt, tz)}`
    : '← Sources';

  const groups = dossier
    ? CATEGORIES.map((c) => [c, dossier.facts.filter((f) => f.category === c)] as const).filter(([, facts]) => facts.length > 0)
    : [];

  const onForget = (fact: DossierFact) => {
    forget.mutate(fact.id, { onSuccess: () => setSelected(null) });
  };

  return (
    <Page
      active="sources"
      refreshing={q.isRefetching}
      onRefresh={() => void q.refetch()}
      footer={
        <View style={[styles.footer, { borderTopColor: palette.hairline }]}>
          <Pressable accessibilityRole="button" onPress={() => setRaw((r) => !r)} hitSlop={8}>
            <Txt style={[sansStyle(15, 22), { textDecorationLine: 'underline' }]}>{raw ? 'Readable view' : 'Raw JSON'}</Txt>
          </Pressable>
          <Txt color="textMuted" style={sansStyle(15, 22)}>
            Correct something
          </Txt>
        </View>
      }
    >
      <View style={{ paddingTop: 20 }}>
        <Pressable accessibilityRole="link" onPress={() => (router.canGoBack() ? router.back() : router.replace('/sources'))} hitSlop={8}>
          <Txt variant="label" color="textMuted">
            {backLine}
          </Txt>
        </Pressable>
        <Txt variant="title" accessibilityRole="header" style={{ marginTop: 10 }}>
          Your dossier
        </Txt>
        <Txt color="textSecondary" style={{ marginTop: 14 }}>
          Everything Morrow knows about you — only what was distilled, never the raw events.
        </Txt>
      </View>

      {!dossier ? (
        <PageState error={q.error} onRetry={() => void q.refetch()} />
      ) : raw ? (
        <ScrollView horizontal style={[styles.raw, { backgroundColor: palette.panel, borderColor: palette.hairline }]}>
          <Txt selectable color="textSecondary" style={monoStyle(11, 16, 0)}>
            {JSON.stringify(dossier, null, 2)}
          </Txt>
        </ScrollView>
      ) : (
        <View style={{ paddingTop: 22 }}>
          {groups.map(([category, facts]) => (
            <View key={category} style={{ marginBottom: 18 }}>
              <Txt variant="label" color="textMuted" style={styles.groupLabel}>
                {categoryLabel(category)}
              </Txt>
              {facts.map((f) => (
                <DossierRow
                  key={f.id}
                  fact={f}
                  selected={selected === f.id}
                  onSelect={() => setSelected((s) => (s === f.id ? null : f.id))}
                  onForget={() => onForget(f)}
                  forgetting={forget.isPending && forget.variables === f.id}
                />
              ))}
            </View>
          ))}
          {dossier.patterns.length > 0 ? (
            <View>
              <Txt variant="label" color="textMuted" style={styles.groupLabel}>
                Patterns · inferred
              </Txt>
              {dossier.patterns.map((p) => (
                <PatternRow key={p.id} pattern={p} />
              ))}
            </View>
          ) : null}
          {forget.isError ? (
            <Txt variant="label" color="danger" style={{ paddingTop: 12 }}>
              Couldn't forget that. Try again.
            </Txt>
          ) : null}
        </View>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  groupLabel: { fontSize: 10, lineHeight: 12, paddingBottom: 10 },
  footer: {
    marginHorizontal: 24,
    borderTopWidth: 1,
    paddingTop: 18,
    paddingBottom: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  raw: { marginTop: 22, borderWidth: 1, borderRadius: 14, padding: 14 },
});
