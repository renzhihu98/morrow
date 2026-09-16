import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { quotaLabel } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { family } from '@/theme/fonts';
import { monoStyle, sansStyle } from '@/theme/typography';
import { ArrowRightIcon, LockIcon, SendIcon } from './Icons';
import { Txt } from './Txt';

export type ComposerState = 'idle' | 'typing' | 'waiting' | 'sealed' | 'limit';

type Props = {
  value: string;
  onChangeText: (t: string) => void;
  onSend: () => void;
  onStop?: () => void;
  /** Tap on "Today's reading →" in the sealed state. */
  onToday?: () => void;
  waiting?: boolean;
  sealed?: boolean;
  limitReached?: boolean;
  used?: number;
  limit?: number;
  /** Hide the `n/15` counter (e.g. before the first question). */
  showCounter?: boolean;
  sealedLabel?: string;
  todayLabel?: string;
  keyboardOpen?: boolean;
};

/**
 * Bottom composer (SPEC §4.4): idle / typing / waiting / sealed (+ limit).
 * Sits 16pt from the sides and 30pt above the screen edge on notched iPhones.
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
    sealedLabel = 'This reading is sealed.',
    todayLabel = 'Today',
    keyboardOpen = false,
  },
  ref,
) {
  const { palette, alpha } = useTheme();
  const insets = useSafeAreaInsets();
  const [focused, setFocused] = useState(false);
  const state: ComposerState = sealed ? 'sealed' : limitReached ? 'limit' : waiting ? 'waiting' : value.length > 0 ? 'typing' : 'idle';
  const bottom = keyboardOpen ? 8 : insets.bottom > 0 ? Math.max(insets.bottom - 4, 16) : 16;

  const shell = [
    styles.shell,
    { backgroundColor: palette.panel, borderColor: palette.hairline, marginBottom: bottom },
    state === 'typing' && focused && { borderColor: alpha.accentBorder },
    (state === 'sealed' || state === 'limit') && { borderStyle: 'dashed' as const, borderColor: palette.hairlineStrong, backgroundColor: 'transparent' },
  ];

  if (state === 'sealed' || state === 'limit') {
    return (
      <View style={shell} accessibilityRole="summary">
        <View style={styles.sealedLeft}>
          <LockIcon color={palette.textMuted} />
          <Txt color="textSecondary" style={sansStyle(14, 20)} numberOfLines={1}>
            {state === 'sealed' ? sealedLabel : 'No questions left today.'}
          </Txt>
        </View>
        {state === 'sealed' && onToday ? (
          <Pressable
            accessibilityRole="button"
            onPress={onToday}
            style={({ pressed }) => [styles.todayButton, { backgroundColor: palette.accentFill, opacity: pressed ? 0.8 : 1 }]}
          >
            <Txt color="onAccent" style={sansStyle(14, 20, true)}>
              {todayLabel}
            </Txt>
            <ArrowRightIcon color={palette.onAccent} />
          </Pressable>
        ) : (
          <Txt variant="label" color="textMuted" style={{ marginRight: 8 }}>
            {`SEALS AT DAWN · 04:00`}
          </Txt>
        )}
      </View>
    );
  }

  const canSend = state === 'typing' && value.trim().length > 0;

  return (
    <View style={shell}>
      <Txt color={state === 'waiting' ? 'textFaint' : 'accent'} style={[monoStyle(15, 20, 0), styles.chevron]}>
        ›
      </Txt>
      {state === 'waiting' ? (
        <Txt color="textFaint" style={[sansStyle(15, 22), styles.input]} accessibilityLiveRegion="polite">
          Morrow is reading…
        </Txt>
      ) : (
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Ask Morrow anything"
          placeholderTextColor={palette.placeholder}
          selectionColor={palette.accent}
          cursorColor={palette.accent}
          style={[styles.input, styles.textInput, { color: palette.textPrimary, fontFamily: family.sans }]}
          returnKeyType="send"
          submitBehavior="submit"
          onSubmitEditing={() => canSend && onSend()}
          multiline={false}
          maxLength={500}
          accessibilityLabel="Ask Morrow"
        />
      )}
      {showCounter && (
        <Txt variant="label" color="textMuted" style={{ letterSpacing: 0 }} accessibilityLabel={`${used} of ${limit} questions today`}>
          {quotaLabel(used, limit)}
        </Txt>
      )}
      {state === 'waiting' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Stop"
          onPress={onStop}
          style={[styles.button, { backgroundColor: palette.subtle }]}
        >
          <View style={[styles.stop, { backgroundColor: palette.textSecondary }]} />
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send"
          accessibilityState={{ disabled: !canSend }}
          disabled={!canSend}
          onPress={onSend}
          style={({ pressed }) => [styles.button, { backgroundColor: palette.accentFill, opacity: pressed ? 0.8 : 1 }]}
        >
          <SendIcon color={palette.onAccent} />
        </Pressable>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  shell: {
    marginHorizontal: 16,
    minHeight: 60,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 10,
    paddingLeft: 18,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chevron: { width: 10 },
  input: { flex: 1 },
  textInput: { fontSize: 15, lineHeight: 20, paddingVertical: 8, margin: 0 },
  button: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stop: { width: 10, height: 10, borderRadius: 2 },
  sealedLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  todayButton: { height: 38, paddingHorizontal: 14, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
});
