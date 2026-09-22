import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { ink } from '@/theme/ink';
import { Header, type NavSection } from './Header';
import { Txt } from './Txt';

type Props = {
  active: NavSection;
  children: ReactNode;
  /** Replaces the default wordmark header (e.g. <ChatHeader /> or <Header mode="back" />). */
  header?: ReactNode;
  /** Rendered between header and scroll content (e.g. sub-bars). */
  bar?: ReactNode;
  /** Fixed footer (e.g. sealed composer). The Composer handles the bottom safe area itself. */
  footer?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Horizontal padding of the scroll body. Default 24 (SPEC §4.F); chat threads use 0 and THREAD_STYLE. */
  gutter?: number;
  scrollProps?: ScrollViewProps;
};

/** Standard screen: flat Parcel ground, safe-area top, header, scrollable body with a 24pt gutter. */
export function Page({ active, children, header, bar, footer, refreshing, onRefresh, gutter = 24, scrollProps }: Props) {
  const { palette } = useTheme();
  return (
    <SafeAreaView edges={footer ? ['top'] : ['top', 'bottom']} style={[styles.root, { backgroundColor: palette.bg }]}>
      {header ?? <Header active={active} />}
      {bar}
      <ScrollView
        contentContainerStyle={[styles.body, { paddingHorizontal: gutter }, footer ? { paddingBottom: 24 } : null]}
        refreshControl={
          onRefresh ? <RefreshControl tintColor={palette.textMuted} refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined
        }
        {...scrollProps}
      >
        {children}
      </ScrollView>
      {footer}
    </SafeAreaView>
  );
}

/** Large serif page title (52/52) with optional content below (counts, description). */
export function PageTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <View style={styles.titleBlock}>
      <Txt variant="title" accessibilityRole="header">
        {title}
      </Txt>
      {children ? <View style={{ marginTop: 16 }}>{children}</View> : null}
    </View>
  );
}

/** Loading / error placeholder in Morrow's voice. */
export function PageState({ error, onRetry }: { error?: unknown; onRetry?: () => void }) {
  return (
    <View style={{ paddingTop: 48, gap: 12 }}>
      <Txt variant="label" color={error ? 'danger' : 'textMuted'}>
        {error ? 'Signal lost' : 'Reading…'}
      </Txt>
      {error ? (
        <Txt color="text" onPress={onRetry} accessibilityRole="button">
          Morrow couldn't reach this page. Tap to try again.
        </Txt>
      ) : null}
    </View>
  );
}

/** 1px ink hairline divider; `dashed` uses the stronger sealed-bar ink. */
export const Hairline = ({ dashed }: { dashed?: boolean }) => {
  const { palette } = useTheme();
  return (
    <View
      style={
        dashed
          ? { borderTopWidth: 1, borderStyle: 'dashed', borderColor: ink.dashed }
          : { height: 1, backgroundColor: palette.hairline }
      }
    />
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingBottom: 48 },
  titleBlock: { paddingTop: 24, paddingBottom: 20 },
});
