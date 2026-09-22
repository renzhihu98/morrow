import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BodyFigure } from '@/components/BodyFigure';
import { Button } from '@/components/Button';
import { GoogleIcon } from '@/components/Icons';
import { AuthHeader } from '@/components/Onboarding';
import { Txt } from '@/components/Txt';
import { setDemoMode } from '@/data/api';
import { authClient } from '@/data/auth';
import { API_URL, REQUEST_TIMEOUT_MS } from '@/data/config';
import { useTheme } from '@/theme/ThemeProvider';

/** true when nothing answers at EXPO_PUBLIC_API_URL (any HTTP status counts as reachable). */
async function serverUnreachable(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    await fetch(`${API_URL}/api/auth/ok`, { credentials: 'omit', signal: controller.signal });
    return false;
  } catch {
    return true;
  } finally {
    clearTimeout(timer);
  }
}

/** v4 screen 01 — Sign in (Google only; Paper BVE). */
export default function SignInScreen() {
  const { palette } = useTheme();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  const probe = useCallback(async () => {
    const down = await serverUnreachable();
    setUnreachable(down);
    return down;
  }, []);

  useEffect(() => {
    void probe();
  }, [probe]);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await authClient.signIn.social({ provider: 'google', callbackURL: '/' });
      if (res.error) {
        const down = await probe();
        setError(down ? null : "Google sign-in didn't finish. Try again.");
      }
    } catch {
      const down = await probe();
      setError(down ? null : "Google sign-in didn't finish. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const exploreDemo = () => {
    qc.removeQueries();
    setDemoMode(true);
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.root, { backgroundColor: palette.bg }]}>
      <AuthHeader />
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        <View style={styles.figure}>
          <BodyFigure height={196} />
        </View>
        <View style={styles.copy}>
          <Txt variant="hero" accessibilityRole="header">
            Meet Morrow.
          </Txt>
          <Txt variant="bodyLg" color="textMuted" style={{ paddingTop: 20 }}>
            A reading a day from the accounts you choose, and prophecies that check themselves.
          </Txt>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {error ? (
          <Txt variant="label" color="danger" style={styles.center}>
            {error}
          </Txt>
        ) : null}
        <Button
          label="Continue with Google"
          icon={<GoogleIcon color={palette.onAccent} size={18} />}
          onPress={() => void signIn()}
          loading={busy}
        />
        <Txt variant="label" color="textMuted" style={[styles.center, { fontSize: 13, lineHeight: 20, paddingHorizontal: 8 }]}>
          Signing in only shares your name and email. Sources are connected separately.
        </Txt>
        <Txt variant="label" color="textMuted" style={styles.center}>
          Raw events kept 24h · never health or money
        </Txt>
        {unreachable ? (
          <Button
            variant="link"
            label="Can't reach Morrow · explore the demo"
            accessibilityLabel="Morrow's server is unreachable. Explore the demo."
            onPress={exploreDemo}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 24 },
  figure: { paddingHorizontal: 24, paddingTop: 56, alignItems: 'flex-start' },
  copy: { paddingHorizontal: 24, paddingTop: 56 },
  footer: { paddingHorizontal: 24, paddingBottom: 12, gap: 16 },
  center: { textAlign: 'center' },
});
