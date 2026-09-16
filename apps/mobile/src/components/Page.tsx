import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { Header, type NavSection } from './Header';
import { Txt } from './Txt';

type Props = {
  active: NavSection;
  children: ReactNode;
  /** Rendered between header and scroll content (e.g. sub-bars). */
  bar?: ReactNode;
  /** Fixed footer (e.g. sealed composer). */
  footer?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scrollProps?: ScrollViewProps;
};

/** Standard screen: safe-area top, header, scrollable 24pt-gutter body. */
export function Page({ active, children, bar, footer, refreshing, onRefresh, scrollProps }: Props) {
  const { palette } = useTheme();
  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: palette.bg }]}>
      <Header active={active} />
      {bar}
      <ScrollView
        contentContainerStyle={[styles.body, footer ? { paddingBottom: 24 } : null]}
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

/** Mono eyebrow + large serif page title. */
export function PageTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <View style={styles.titleBlock}>
      <Txt variant="label" color="textMuted">
        {eyebrow}
      </Txt>
      <Txt variant="title" accessibilityRole="header" style={{ marginTop: 10 }}>
        {title}
      </Txt>
      {children ? <View style={{ marginTop: 18 }}>{children}</View> : null}
    </View>
  );
}

/** Loading / error placeholder in Morrow's voice. */
export function PageState({ error, onRetry }: { error?: unknown; onRetry?: () => void }) {
  return (
    <View style={{ paddingTop: 48, gap: 12 }}>
      <Txt variant="label" color={error ? 'danger' : 'textMuted'}>
        {error ? 'SIGNAL LOST' : 'READING…'}
      </Txt>
      {error ? (
        <Txt color="textSecondary" onPress={onRetry} accessibilityRole="button">
          Morrow couldn't reach this page. Tap to try again.
        </Txt>
      ) : null}
    </View>
  );
}

export const Hairline = ({ dashed }: { dashed?: boolean }) => {
  const { palette } = useTheme();
  return (
    <View
      style={
        dashed
          ? { borderTopWidth: 1, borderStyle: 'dashed', borderColor: palette.hairlineStrong }
          : { height: 1, backgroundColor: palette.hairline }
      }
    />
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: 24, paddingBottom: 48 },
  titleBlock: { paddingTop: 20, paddingBottom: 18 },
});
