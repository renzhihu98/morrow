import type { Source, SourceKind } from '@morrow/core';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dot } from '@/components/Dot';
import { ArrowRightIcon } from '@/components/Icons';
import { AuthHeader, PrimaryButton } from '@/components/Onboarding';
import { Hairline } from '@/components/Page';
import { Txt } from '@/components/Txt';
import { useLinkSource } from '@/data/queries';
import { drawFirstReading, useFirstReading, useGate, useMe } from '@/data/session';
import { formatCount, sourceGlyph } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { monoStyle, sansStyle, serifStyle } from '@/theme/typography';

type Card = { kind: SourceKind; name: string; reads: string; never: string };

const CARDS: Card[] = [
  {
    kind: 'calendar',
    name: 'Google Calendar',
    reads: "Reads when things happen and who's invited.",
    never: 'Never descriptions, notes, attachments.',
  },
  {
    kind: 'spotify',
    name: 'Spotify',
    reads: 'Reads what you play, and when.',
    never: 'Never messages, followers, your profile.',
  },
];

function metaLine(source: Source | undefined): string {
  if (!source || source.status === 'not_linked') return 'RECOMMENDED';
  if (source.status === 'error') return 'NEEDS ATTENTION';
  if (source.stat) return `${formatCount(source.stat.value)} ${source.stat.label.toUpperCase()} FOUND`;
  return 'READING…';
}

/** Screen 14 — Connect accounts (onboarding step 2 of 3). */
export default function ConnectAccountsScreen() {
  const { palette } = useTheme();
  const qc = useQueryClient();
  const { userId } = useGate();
  const me = useMe();
  const link = useLinkSource('/welcome/sources');
  const first = useFirstReading();
  const [notice, setNotice] = useState<string | null>(null);

  const byKind = new Map((me.data?.sources ?? []).map((s) => [s.kind, s]));
  const linkedCount = CARDS.filter((c) => byKind.get(c.kind)?.status === 'linked').length;
  const drawing = first.state === 'drawing';

  const connect = (kind: SourceKind) => {
    setNotice(null);
    link.mutate(kind, {
      onSuccess: (r) => setNotice(r.notice),
      onError: () => setNotice("Couldn't finish connecting. Try again."),
    });
  };

  const draw = () => void drawFirstReading(qc, userId);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.root, { backgroundColor: palette.bg }]}>
      <AuthHeader note="STEP 2 OF 3" />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={styles.titleBlock}>
          <Txt accessibilityRole="header" style={serifStyle(42, 44, -0.015)}>
            What may Morrow read?
          </Txt>
          <Txt color="textSecondary" style={[sansStyle(14, 21), { paddingTop: 10 }]}>
            Start with two. Morrow asks before it needs more.
          </Txt>
        </View>

        <View style={styles.cards}>
          {CARDS.map((card) => (
            <SourceCard
              key={card.kind}
              card={card}
              source={byKind.get(card.kind)}
              connecting={link.isPending && link.variables === card.kind}
              disabled={link.isPending || drawing}
              onConnect={() => connect(card.kind)}
            />
          ))}
        </View>
        {notice ? (
          <Txt variant="label" color="textMuted" upper={false} style={{ paddingHorizontal: 24, paddingTop: 12 }}>
            {notice}
          </Txt>
        ) : null}

        <View style={styles.later}>
          <Txt color="textMuted" style={[monoStyle(10, 12), { paddingBottom: 8 }]}>
            LATER · WHEN A PROPHECY NEEDS IT
          </Txt>
          <Hairline dashed />
          <View style={styles.laterRow} accessible accessibilityLabel="Gmail and Instagram. Locked until a prophecy needs them.">
            <Txt color="textSecondary" style={serifStyle(19, 24)}>
              Gmail · Instagram
            </Txt>
            <Txt color="textFaint" style={monoStyle(10, 12)}>
              LOCKED
            </Txt>
          </View>
          <Hairline dashed />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {first.state === 'error' && first.message ? (
          <Txt variant="label" color="danger" upper={false} style={{ textAlign: 'center' }}>
            {first.message}
          </Txt>
        ) : null}
        <PrimaryButton
          label="Draw my first reading"
          height={50}
          trailing={<ArrowRightIcon color={palette.onAccent} size={14} />}
          disabled={linkedCount === 0}
          busy={drawing}
          accessibilityHint={linkedCount === 0 ? 'Connect at least one source first' : undefined}
          onPress={draw}
        />
        <Pressable accessibilityRole="button" onPress={draw} disabled={drawing} hitSlop={10}>
          <Txt color="textMuted" style={[sansStyle(13, 18), { textAlign: 'center' }]}>
            Skip for now
          </Txt>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function SourceCard({
  card,
  source,
  connecting,
  disabled,
  onConnect,
}: {
  card: Card;
  source: Source | undefined;
  connecting: boolean;
  disabled: boolean;
  onConnect: () => void;
}) {
  const { palette, alpha } = useTheme();
  const linked = source?.status === 'linked';
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: palette.panel, borderColor: linked ? alpha.accentBorder : palette.hairline },
      ]}
    >
      <View style={styles.cardTop}>
        <View style={[styles.glyph, { borderColor: palette.hairlineStrong }]}>
          <Txt style={monoStyle(11, 14, 0)}>{sourceGlyph(card.kind)}</Txt>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt style={serifStyle(22, 24)}>{card.name}</Txt>
          <Txt color="textMuted" style={monoStyle(10, 12, 0)}>
            {metaLine(source)}
          </Txt>
        </View>
        {linked ? (
          <View style={styles.linked}>
            <Dot color={palette.accent} size={7} />
            <Txt variant="label" color="accent">
              LINKED
            </Txt>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Connect ${card.name}`}
            onPress={onConnect}
            disabled={disabled}
            style={({ pressed }) => [
              styles.connect,
              { borderColor: palette.hairlineStrong, opacity: pressed || connecting ? 0.6 : disabled ? 0.5 : 1 },
            ]}
          >
            <Txt style={sansStyle(13, 18, true)}>{connecting ? 'Opening…' : 'Connect'}</Txt>
          </Pressable>
        )}
      </View>
      <View style={[styles.cardBody, { borderTopColor: palette.hairline }]}>
        <Txt color="textSecondary" style={sansStyle(13, 19)}>
          {card.reads}
        </Txt>
        <Txt color="textMuted" style={sansStyle(13, 19)}>
          {card.never}
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  titleBlock: { paddingHorizontal: 24, paddingTop: 18 },
  cards: { paddingHorizontal: 16, paddingTop: 20, gap: 10 },
  card: { borderRadius: 14, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  glyph: { width: 36, height: 36, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  linked: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  connect: { height: 32, paddingHorizontal: 14, borderRadius: 9, borderWidth: 1, justifyContent: 'center' },
  cardBody: { borderTopWidth: 1, paddingTop: 10, gap: 4 },
  later: { paddingHorizontal: 24, paddingTop: 18 },
  laterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  footer: { paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
});
