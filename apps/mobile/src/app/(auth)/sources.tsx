import type { Source, SourceKind } from '@morrow/core';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Dot } from '@/components/Dot';
import { AuthHeader } from '@/components/Onboarding';
import { Hairline } from '@/components/Page';
import { Txt } from '@/components/Txt';
import { useLinkSource } from '@/data/queries';
import { drawFirstReading, useFirstReading, useGate, useMe } from '@/data/session';
import { formatCount } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { ink } from '@/theme/ink';
import { sansStyle, serifStyle } from '@/theme/typography';

type Card = { kind: SourceKind; name: string; reads: string; never: string };

const CARDS: Card[] = [
  {
    kind: 'calendar',
    name: 'Google Calendar',
    reads: "Reads what's on every calendar and who's invited.",
    never: 'Never attachments or video-call links.',
  },
  {
    kind: 'spotify',
    name: 'Spotify',
    reads: 'Reads what you play, and when.',
    never: 'Never messages, followers, your profile.',
  },
  {
    kind: 'mail',
    name: 'Gmail',
    reads: "Reads who you write to and what's waiting on a reply.",
    never: 'Never promotions or spam. Messages become notes, then are deleted.',
  },
];

/** Meta under the source name: numerals in Geist Mono, words in Geist (SPEC §4.D). */
function MetaLine({ source }: { source: Source | undefined }) {
  if (source?.status === 'linked' && source.stat) {
    return (
      <Txt variant="label" color="textMuted">
        <Txt variant="meta" color="textMuted">
          {formatCount(source.stat.value)}
        </Txt>
        {` ${source.stat.label} found`}
      </Txt>
    );
  }
  const text =
    !source || source.status === 'not_linked' ? 'Recommended' : source.status === 'error' ? 'Needs attention' : 'Reading…';
  return (
    <Txt variant="label" color="textMuted">
      {text}
    </Txt>
  );
}

/** v4 screen 02 — Connect accounts (onboarding step 2 of 3; Paper CAQ). */
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
      <AuthHeader note="Step 2 of 3" />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={styles.titleBlock}>
          <Txt accessibilityRole="header" style={serifStyle(40, 44, -0.02)}>
            What may Morrow read?
          </Txt>
          <Txt color="textMuted">Start with two. Morrow asks before it needs more.</Txt>
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
          <Txt variant="label" color="textMuted" style={{ paddingHorizontal: 24, paddingTop: 12 }}>
            {notice}
          </Txt>
        ) : null}

        <View style={styles.later}>
          <Txt variant="label" color="textMuted" style={{ paddingBottom: 8 }}>
            Later — when a prophecy needs it
          </Txt>
          <Hairline dashed />
          <View style={styles.laterRow} accessible accessibilityLabel="Instagram. Locked until a prophecy needs it.">
            <Txt color="textMuted" style={serifStyle(20, 24)}>
              Instagram
            </Txt>
            <Txt variant="label" color="textMuted">
              Locked
            </Txt>
          </View>
          <Hairline dashed />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {first.state === 'error' && first.message ? (
          <Txt variant="label" color="danger" style={{ textAlign: 'center' }}>
            {first.message}
          </Txt>
        ) : null}
        <Button
          label="Draw my first reading →"
          accessibilityLabel="Draw my first reading"
          disabled={linkedCount === 0}
          loading={drawing}
          onPress={draw}
        />
        <Button variant="link" label="Skip for now" onPress={draw} disabled={drawing} />
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
  const { palette } = useTheme();
  const linked = source?.status === 'linked';
  return (
    <View
      style={[styles.card, { backgroundColor: palette.surface, borderColor: linked ? LINKED_BORDER : palette.hairline }]}
    >
      <View style={styles.cardTop}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt style={serifStyle(23, 26, -0.01)}>{card.name}</Txt>
          <MetaLine source={source} />
        </View>
        {linked ? (
          <View style={styles.linked} accessible accessibilityLabel={`${card.name} linked`}>
            <Dot color={palette.highlight} size={8} style={{ borderWidth: 1, borderColor: ink.outline }} />
            <Txt medium style={sansStyle(13, 18, true)}>
              Linked
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
              { borderColor: palette.accent, opacity: pressed || connecting ? 0.6 : disabled ? 0.5 : 1 },
            ]}
          >
            <Txt color="accent" style={sansStyle(14, 18, true)}>
              {connecting ? 'Opening…' : 'Connect'}
            </Txt>
          </Pressable>
        )}
      </View>
      <View style={[styles.cardBody, { borderTopColor: palette.hairline }]}>
        <Txt color="text" style={sansStyle(14, 21)}>
          {card.reads}
        </Txt>
        <Txt color="textMuted" style={sansStyle(14, 21)}>
          {card.never}
        </Txt>
      </View>
    </View>
  );
}

/** Oxblood at 45% — the linked card's outline (Paper CAQ). */
const LINKED_BORDER = 'rgba(90,29,34,0.45)';

const styles = StyleSheet.create({
  root: { flex: 1 },
  titleBlock: { paddingHorizontal: 24, paddingTop: 20, gap: 10 },
  cards: { paddingHorizontal: 24, paddingTop: 20, gap: 10 },
  card: { borderRadius: 14, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  linked: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  connect: { height: 34, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, justifyContent: 'center' },
  cardBody: { borderTopWidth: 1, paddingTop: 12, gap: 2 },
  later: { paddingHorizontal: 24, paddingTop: 16 },
  laterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  footer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12, gap: 14 },
});
