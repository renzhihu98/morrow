import { Stack } from 'expo-router';
import { useGate } from '@/data/session';
import { useTheme } from '@/theme/ThemeProvider';

/** Onboarding stack (SPEC §12.1): 13 sign in → 14 connect accounts. */
export default function AuthLayout() {
  const { palette } = useTheme();
  const { status } = useGate();
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: palette.bg } }}>
      <Stack.Protected guard={status !== 'onboarding'}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'onboarding'}>
        <Stack.Screen name="sources" />
      </Stack.Protected>
    </Stack>
  );
}
