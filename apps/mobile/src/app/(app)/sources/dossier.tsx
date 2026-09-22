import { formatLocalTime, type DossierCategory, type DossierFact } from '@morrow/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { DossierRow, PatternRow } from '@/components/DossierRow';
import { BackIcon } from '@/components/Icons';
import { Page, PageState } from '@/components/Page';
import { Txt } from '@/components/Txt';
import { useDossier, useForgetFact, useToday } from '@/data/queries';
import { formatBytes } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { monoStyle } from '@/theme/typography';

const CATEGORIES: DossierCategory[] = ['rhythms', 'pursuits', 'people', 'places', 'tastes'];

/** `rhythms` → `Rhythms`. */
const categoryLabel = (c: DossierCategory) => c.charAt(0).toUpperCase() + c.slice(1);

/** Readable / Raw JSON segmented switch. */
function ViewSwitch({ raw, onChange }: { raw: boolean; onChange: (raw: boolean) => void }) {
  const { palette } = useTheme();
  const seg = (label: string, value: boolean) => {
    const on = raw === value;
    return (
      <Pressable
        key={label}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        onPress={() => onChange(value)}
        style={[styles.seg, on && { backgroundColor: palette.surface, borderColor: palette.hairline, borderWidth: 1 }]}
      >
        <Txt variant="label" medium={on} color={on ? 'text' : 'textMuted'} style={{ fontSize: 13, lineHeight: 18 }}>
          {label}
        </Txt>
      </Pressable>
    );
  };
  return (
    <View style={[styles.switch, { borderColor: palette.hairline }]} accessibilityRole="tablist">
      {seg('Readable', false)}
      {seg('Raw JSON', true)}
    </View>
  );
}

/** v4 screen 13 — the distilled dossier (Paper C9R): readable ↔ raw JSON, forget a single fact. */
export default function DossierScreen() {
  const q = useDossier();
  const today = useToday();
  const forget = useForgetFact();
  const { palette } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const [raw, setRaw] = useState(false);
  const tz = today.data?.user.timezone ?? 'UTC';
  const dossier = q.data?.dossier;

  const groups = dossier
    ? CATEGORIES.map((c) => [c, dossier.facts.filter((f) => f.category === c)] as const).filter(([, facts]) => facts.length > 0)
    : [];

  const onForget = (fact: DossierFact) => {
    forget.mutate(fact.id, { onSuccess: () => setSelected(null) });
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/sources'));

  return (
    <Page
      active="sources"
      refreshing={q.isRefetching}
      onRefresh={() => void q.refetch()}
      footer={
        <View style={[styles.footer, { borderTopColor: palette.hairline }]}>
          <Button
            variant="link"
            label="Download JSON"
            disabled={!dossier}
            onPress={() => dossier && void Share.share({ message: JSON.stringify(dossier, null, 2) })}
          />
          <Txt color="textMuted" style={{ fontSize: 14, lineHeight: 20 }}>
            Correct something
          </Txt>
        </View>
      }
    >
      <View style={{ paddingTop: 16 }}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Back to Sources"
          onPress={back}
          hitSlop={8}
          style={styles.back}
        >
          <BackIcon color={palette.accent} size={16} />
          <Txt variant="label" color="textMuted">
            Sources
            {dossier ? (
              <>
                {' · '}
                <Txt variant="meta" color="textMuted">
                  {formatBytes(dossier.sizeBytes)}
                </Txt>
                {' · rebuilt '}
                <Txt variant="meta" color="textMuted">
                  {formatLocalTime(dossier.rebuiltAt, tz)}
                </Txt>
              </>
            ) : null}
          </Txt>
        </Pressable>
        <Txt variant="title" accessibilityRole="header" style={{ marginTop: 14 }}>
          Your dossier
        </Txt>
        <Txt style={{ marginTop: 14 }}>
          Everything Morrow knows about you — only what was distilled, never the raw events.
        </Txt>
        <View style={{ paddingTop: 18 }}>
          <ViewSwitch raw={raw} onChange={setRaw} />
        </View>
      </View>

      {!dossier ? (
        <PageState error={q.error} onRetry={() => void q.refetch()} />
      ) : raw ? (
        <ScrollView horizontal style={[styles.raw, { backgroundColor: palette.surface, borderColor: palette.hairline }]}>
          <Txt selectable color="text" style={monoStyle(11, 16)}>
            {JSON.stringify(dossier, null, 2)}
          </Txt>
        </ScrollView>
      ) : (
        <View style={{ paddingTop: 24 }}>
          {groups.map(([category, facts]) => (
            <View key={category} style={{ marginBottom: 24 }}>
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
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  switch: { flexDirection: 'row', alignSelf: 'flex-start', borderWidth: 1, borderRadius: 20, padding: 3 },
  seg: { borderRadius: 16, paddingVertical: 5, paddingHorizontal: 14, borderColor: 'transparent', borderWidth: 1 },
  groupLabel: { paddingBottom: 10 },
  footer: {
    marginHorizontal: 24,
    borderTopWidth: 1,
    paddingTop: 18,
    paddingBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  raw: { marginTop: 22, borderWidth: 1, borderRadius: 14, padding: 14 },
});
