import { formatProphecyNumber, windowProgress, type Prophecy } from '@morrow/core';
import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { clamp01, splitStepLabel, stepGlyph, windowLabel, type StepStatus } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { em, sansStyle, serifStyle } from '@/theme/typography';
import { Dot } from './Dot';
import { Txt } from './Txt';

/** `YOU — 06:51` (muted) / `● MORROW — 06:52` (accent). */
export function TurnLabel({ who, time, dotless }: { who: 'you' | 'morrow'; time?: string; dotless?: boolean }) {
  const { palette } = useTheme();
  const text = `${who === 'you' ? 'YOU' : 'MORROW'}${time ? ` — ${time}` : ''}`;
  if (who === 'you') return <Txt variant="label" color="textMuted">{text}</Txt>;
  return (
    <View style={styles.turnRow}>
      {!dotless && <Dot color={palette.accent} />}
      <Txt variant="label" color="accent">
        {text}
      </Txt>
    </View>
  );
}

/** `SOURCE Calendar · 03.04 · 04.22 …` */
export function EvidenceLine({ label }: { label: string }) {
  return (
    <Txt variant="label" color="textMuted" upper={false} style={{ lineHeight: 16, letterSpacing: em(0.02, 11) }}>
      {`SOURCE ${label}`}
    </Txt>
  );
}

/** Thin 2px track with an accent fill. */
export function ProgressTrack({ value, width, inRow = false }: { value: number; width?: number; inRow?: boolean }) {
  const { palette } = useTheme();
  const size = width !== undefined ? { width } : inRow ? { flex: 1 } : { alignSelf: 'stretch' as const };
  return (
    <View style={[styles.track, { backgroundColor: palette.subtle }, size]}>
      <View style={{ height: 2, width: `${clamp01(value) * 100}%`, backgroundColor: palette.accent }} />
    </View>
  );
}

/** Start → end window bar with elapsed fill. */
export const WindowBar = ({ progress }: { progress: number }) => <ProgressTrack value={progress} inRow />;

type PanelProps = { prophecy: Prophecy; now: Date; timeZone: string; dim?: boolean };

/** Prophecy panel inside a reading: number + window, serif statement, likelihood. */
export function ProphecyPanel({ prophecy, now, timeZone, dim }: PanelProps) {
  const { palette } = useTheme();
  const right = windowLabel(prophecy, now, timeZone);
  return (
    <View
      style={[styles.panel, { backgroundColor: palette.panel, borderColor: palette.hairline }, dim && { opacity: 0.35 }]}
      accessible
      accessibilityLabel={`Prophecy ${formatProphecyNumber(prophecy.number)}. ${prophecy.statement}. Likelihood ${prophecy.likelihood.toFixed(2)}`}
    >
      <View style={styles.between}>
        <Txt variant="label" color="accent">{`PROPHECY ${formatProphecyNumber(prophecy.number)}`}</Txt>
        <Txt variant="label" color={prophecy.status === 'fulfilled' ? 'accent' : right.urgent ? 'accent' : 'textMuted'}>
          {right.text}
        </Txt>
      </View>
      <Txt variant="prophecy" style={{ letterSpacing: 0 }}>
        {prophecy.statement}
      </Txt>
      <View style={[styles.between, styles.panelFooter, { borderTopColor: palette.hairline }]}>
        <View style={styles.likelihood}>
          <Txt variant="label" color="textMuted">LIKELIHOOD</Txt>
          <ProgressTrack value={prophecy.likelihood} width={72} />
        </View>
        <Txt variant="label" upper={false} style={{ fontSize: 12, lineHeight: 16, letterSpacing: 0 }}>
          {prophecy.likelihood.toFixed(2)}
        </Txt>
      </View>
    </View>
  );
}

/** Prophecies list card (09): `0050 · 09.26`, closes label, statement, window bar + likelihood. */
export function ProphecyCard({ prophecy, now, timeZone }: PanelProps) {
  const { palette } = useTheme();
  const right = windowLabel(prophecy, now, timeZone);
  const made = prophecy.madeOn.slice(5).replace('-', '.');
  return (
    <View
      style={[styles.card, { backgroundColor: palette.panel, borderColor: palette.hairline }]}
      accessible
      accessibilityLabel={`Prophecy ${formatProphecyNumber(prophecy.number)}, ${right.text.toLowerCase()}. ${prophecy.statement}`}
    >
      <View style={styles.between}>
        <Txt variant="label" color="textMuted">{`${formatProphecyNumber(prophecy.number)} · ${made}`}</Txt>
        <Txt variant="label" color={right.urgent ? 'accent' : 'textMuted'}>
          {right.text}
        </Txt>
      </View>
      <Txt style={serifStyle(20, 26, -0.01)}>{prophecy.statement}</Txt>
      <View style={[styles.likelihood, { gap: 16 }]}>
        <WindowBar progress={windowProgress(prophecy, now)} />
        <Txt variant="label" color="textMuted" style={{ letterSpacing: 0 }}>
          {prophecy.likelihood.toFixed(2)}
        </Txt>
      </View>
    </View>
  );
}

export type StepItem = { key: string; label: string; detail: string | null; status: StepStatus };

export const stepsFromCore = (items: { label: string; status: StepStatus }[]): StepItem[] =>
  items.map((s, i) => ({ key: String(i), ...splitStepLabel(s.label), status: s.status }));

/** Left-bordered "Morrow is reading" list: ✓ done · ◌ active (accent) · · pending (faint). */
export function ReadingSteps({ steps, heading = true }: { steps: StepItem[]; heading?: boolean }) {
  const { palette } = useTheme();
  return (
    <View style={{ gap: 14 }} accessibilityLiveRegion="polite">
      {heading && (
        <View style={styles.turnRow}>
          <Dot color={palette.accent} />
          <Txt variant="label" color="accent">MORROW IS READING</Txt>
          <View style={[styles.turnRow, { gap: 4 }]}>
            <Dot color={palette.accent} size={4} />
            <Dot color={palette.accent} size={4} style={{ opacity: 0.55 }} />
            <Dot color={palette.accent} size={4} style={{ opacity: 0.2 }} />
          </View>
        </View>
      )}
      <View style={[styles.steps, { borderLeftColor: palette.hairline }]}>
        {steps.map((s) => (
          <View key={s.key} style={{ gap: 3 }}>
            <Txt
              variant="label"
              color={s.status === 'active' ? 'accent' : s.status === 'done' ? 'textMuted' : 'textFaint'}
            >{`${stepGlyph(s.status)} ${s.label}`}</Txt>
            {s.detail && s.status !== 'pending' ? (
              <Txt color={s.status === 'active' ? 'textPrimary' : 'textSecondary'} style={sansStyle(14, 20)}>
                {s.detail}
              </Txt>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Mono number column + label, hairline dividers (suggestions, menu). */
export function IndexList<T>({
  items,
  renderLabel,
  onPress,
}: {
  items: T[];
  renderLabel: (item: T, index: number) => string;
  onPress?: (item: T, index: number) => void;
}) {
  const { palette } = useTheme();
  return (
    <View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.hairline }}>
      {items.map((item, i) => {
        const label = renderLabel(item, i);
        return (
          <Pressable
            key={`${i}-${label}`}
            accessibilityRole="button"
            onPress={() => onPress?.(item, i)}
            style={({ pressed }) => [styles.indexRow, { borderTopColor: palette.hairline, opacity: pressed ? 0.6 : 1 }]}
          >
            <Txt variant="label" color="textMuted" style={styles.indexNum}>
              {String(i + 1).padStart(2, '0')}
            </Txt>
            <Txt style={sansStyle(15, 22)}>{label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/** `07 FULFILLED   03 OPEN   02 EXPIRED` + optional 12 record marks. */
export function RecordMarks({
  record,
  showMarks = false,
}: {
  record: { fulfilled: number; open: number; expired: number; marks: Prophecy['status'][] };
  showMarks?: boolean;
}) {
  const { palette } = useTheme();
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    <View style={{ gap: 12 }}>
      <View style={[styles.turnRow, { gap: 28 }]}>
        <Txt variant="label" color="accent">{`${p(record.fulfilled)} FULFILLED`}</Txt>
        <Txt variant="label" color="textSecondary">{`${p(record.open)} OPEN`}</Txt>
        <Txt variant="label" color="textMuted">{`${p(record.expired)} EXPIRED`}</Txt>
      </View>
      {showMarks && (
        <View style={[styles.turnRow, { gap: 8 }]} accessibilityLabel="Last 12 prophecies">
          {record.marks.map((m, i) => (
            <Fragment key={i}>
              {m === 'fulfilled' ? (
                <Dot color={palette.accent} size={8} />
              ) : m === 'expired' ? (
                <View style={{ width: 8, height: 1.5, backgroundColor: palette.textMuted }} />
              ) : (
                <View style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: palette.textSecondary }} />
              )}
            </Fragment>
          ))}
        </View>
      )}
    </View>
  );
}

/** Status mark used in lists: filled (fulfilled) · hollow (open) · dash (expired). */
export function StatusMark({ status }: { status: Prophecy['status'] }) {
  const { palette } = useTheme();
  if (status === 'fulfilled') return <Dot color={palette.accent} size={8} />;
  if (status === 'open') return <View style={{ width: 9, height: 9, borderRadius: 5, borderWidth: 1, borderColor: palette.textSecondary }} />;
  return <View style={{ width: 6, height: 1, backgroundColor: palette.textMuted }} />;
}

const styles = StyleSheet.create({
  turnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  track: { height: 2, flexDirection: 'row', overflow: 'hidden' },
  panel: { borderRadius: 16, borderWidth: 1, padding: 18, gap: 14 },
  panelFooter: { borderTopWidth: 1, paddingTop: 12 },
  likelihood: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
  steps: { borderLeftWidth: 1, paddingLeft: 16, gap: 12 },
  indexRow: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingVertical: 12, borderTopWidth: 1 },
  indexNum: { width: 18, letterSpacing: 0 },
});
