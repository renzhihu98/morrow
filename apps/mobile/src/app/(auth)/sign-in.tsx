import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoogleIcon } from '@/components/Icons';
import { AuthHeader, PrimaryButton } from '@/components/Onboarding';
import { Orbit } from '@/components/Orbit';
import { Txt } from '@/components/Txt';
import { setDemoMode } from '@/data/api';
import { authClient } from '@/data/auth';
import { API_URL, REQUEST_TIMEOUT_MS } from '@/data/config';
import { useTheme } from '@/theme/ThemeProvider';
import { sansStyle, serifStyle } from '@/theme/typography';

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

/** Screen 13 — Sign in (Google only). */
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
      <AuthHeader note="Private beta" />
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        <View style={styles.orbit}>
          <Orbit state="idle" size={220} />
        </View>
        <View style={styles.copy}>
          <Txt accessibilityRole="header" style={serifStyle(52, 54, -0.015)}>
            Meet Morrow.
          </Txt>
          <Txt color="textSecondary" style={[sansStyle(15, 23), { paddingTop: 14 }]}>
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
        <PrimaryButton
          label="Continue with Google"
          icon={<GoogleIcon color={palette.onAccent} />}
          onPress={() => void signIn()}
          busy={busy}
        />
        <Txt color="textMuted" style={[sansStyle(12, 18), styles.center, { paddingHorizontal: 8 }]}>
          Signing in only shares your name and email. Sources are connected separately.
        </Txt>
        <Txt color="textMuted" style={[sansStyle(12, 18), styles.center, { paddingTop: 6 }]}>
          Raw events kept 24h · never health or money
        </Txt>
        {unreachable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Morrow's server is unreachable. Explore the demo."
            onPress={exploreDemo}
            hitSlop={10}
          >
            <Txt color="accent" style={[sansStyle(12, 18), styles.center]}>
              {"Can't reach Morrow · explore the demo →"}
            </Txt>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 24 },
  orbit: { alignItems: 'center', paddingTop: 24 },
  copy: { paddingHorizontal: 24, paddingTop: 28 },
  footer: { paddingHorizontal: 16, paddingBottom: 12, gap: 14 },
  center: { textAlign: 'center' },
});
