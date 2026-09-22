import { radii } from '@morrow/tokens';
import { forwardRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { quotaLabel } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { family } from '@/theme/fonts';
import { ink } from '@/theme/ink';
import { ArrowRightIcon, LockIcon, SendIcon } from './Icons';
import { Txt } from './Txt';

export type ComposerState = 'idle' | 'typing' | 'waiting' | 'sealed' | 'limit';

type Props = {
  value: string;
  onChangeText: (t: string) => void;
  onSend: () => void;
  onStop?: () => void;
  /** Tap on "Today →" in the sealed state. */
  onToday?: () => void;
  waiting?: boolean;
  sealed?: boolean;
  limitReached?: boolean;
  used?: number;
  limit?: number;
  /** Show the mono `n/15` counter. */
  showCounter?: boolean;
  placeholder?: string;
  sealedLabel?: string;
  todayLabel?: string;
  keyboardOpen?: boolean;
  /**
   * `chat` (default): docked bar with a hairline top border, 16pt inset, 52pt pill (Reading/Asking/Answer/Sealed).
   * `page`: free-standing 56pt pill with 24pt margins (Today).
   */
  dock?: 'chat' | 'page';
};

/**
 * Bottom composer (SPEC §4.F, Paper BQQ/BH0/C7K/B2K/B7D): idle / typing / waiting / sealed (+ limit).
 * `surface` pill with hairline, Geist 16 input, mono `n/15`, 40pt round Oxblood send.
 * Never shows source chips.
 */
export const Composer = forwardRef<TextInput, Props>(function Composer(
  {
    value,
    onChangeText,
    onSend,
    onStop,
    onToday,
    waiting,
    sealed,
    limitReached,
    used = 0,
    limit = 15,
    showCounter = true,
    placeholder = 'Ask Morrow anything…',
    sealedLabel = 'This reading is sealed.',
    todayLabel = 'Today',
    keyboardOpen = false,
    dock = 'chat',
  },
  ref,
) {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const state: ComposerState = sealed ? 'sealed' : limitReached ? 'limit' : waiting ? 'waiting' : value.length > 0 ? 'typing' : 'idle';
  const page = dock === 'page';
  const bottom = keyboardOpen ? 8 : Math.max(insets.bottom - 9, 12);

  const wrap = [
    page ? styles.dockPage : [styles.dockChat, { backgroundColor: palette.bg, borderTopColor: palette.hairline }],
    { paddingBottom: bottom },
  ];
  const pill = page ? styles.pillPage : styles.pillChat;

  if (state === 'sealed' || state === 'limit') {
    return (
      <View style={wrap}>
        <View style={[styles.shell, pill, { borderStyle: 'dashed', borderColor: ink.dashed }]} accessibilityRole="summary">
          <LockIcon color={palette.accent} />
          <Txt variant="body" color="textMuted" style={styles.grow} numberOfLines={1}>
            {state === 'sealed' ? sealedLabel : 'No questions left today.'}
          </Txt>
          {state === 'sealed' && onToday ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={todayLabel}
              onPress={onToday}
              style={({ pressed }) => [styles.today, { backgroundColor: palette.accent, opacity: pressed ? 0.85 : 1 }]}
            >
              <Txt medium color="onAccent" style={styles.todayText}>
                {todayLabel}
              </Txt>
              <ArrowRightIcon color={palette.onAccent} />
            </Pressable>
          ) : state === 'limit' ? (
            <Txt variant="label" color="textMuted" style={{ marginRight: 10 }}>
              Seals at dawn · 04:00
            </Txt>
          ) : null}
        </View>
      </View>
    );
  }

  const canSend = state === 'typing' && value.trim().length > 0;

  return (
    <View style={wrap}>
      <View style={[styles.shell, pill, { backgroundColor: palette.surface, borderColor: palette.hairline }]}>
        {state === 'waiting' ? (
          <Txt variant="bodyLg" color="textMuted" style={styles.grow} accessibilityLiveRegion="polite">
            Morrow is reading…
          </Txt>
        ) : (
          <TextInput
            ref={ref}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={palette.textMuted}
            selectionColor={palette.accent}
            cursorColor={palette.accent}
            style={[styles.grow, styles.input, { color: palette.text, fontFamily: family.sans }]}
            returnKeyType="send"
            submitBehavior="submit"
            onSubmitEditing={() => canSend && onSend()}
            multiline={false}
            maxLength={500}
            accessibilityLabel="Ask Morrow"
          />
        )}
        {showCounter && (
          <Txt variant="meta" color="textMuted" accessibilityLabel={`${used} of ${limit} questions today`}>
            {quotaLabel(used, limit)}
          </Txt>
        )}
        {state === 'waiting' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Stop"
            onPress={onStop}
            hitSlop={4}
            style={({ pressed }) => [styles.round, styles.stopRing, { borderColor: palette.accent, opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={[styles.stop, { backgroundColor: palette.accent }]} />
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            accessibilityState={{ disabled: !canSend }}
            disabled={!canSend}
            onPress={onSend}
            hitSlop={4}
            style={({ pressed }) => [styles.round, { backgroundColor: palette.accent, opacity: pressed ? 0.85 : 1 }]}
          >
            <SendIcon color={palette.onAccent} />
          </Pressable>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  dockChat: { borderTopWidth: 1, paddingTop: 10, paddingHorizontal: 16 },
  dockPage: { paddingHorizontal: 24 },
  shell: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, paddingLeft: 18 },
  pillChat: { height: 52, borderRadius: 26, paddingRight: 6 },
  pillPage: { height: 56, borderRadius: radii.button, paddingRight: 8 },
  grow: { flex: 1 },
  input: { fontSize: 16, lineHeight: 22, paddingVertical: 0, margin: 0, height: 40 },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  stopRing: { borderWidth: 1 },
  stop: { width: 11, height: 11, borderRadius: 2 },
  today: { height: 40, borderRadius: 20, paddingLeft: 18, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  todayText: { fontSize: 15, lineHeight: 20 },
});
