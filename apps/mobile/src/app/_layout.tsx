import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { isApiError } from '@morrow/core';
import { fontAssets } from '@/theme/fonts';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync().catch(() => {
  /* splash already hidden (fast refresh) */
});

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (count, error) => !(isApiError(error) && error.status >= 400 && error.status < 500) && count < 1,
      },
    },
  });
}

function ThemedStack() {
  const { name, palette } = useTheme();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(palette.bg).catch(() => {});
  }, [palette.bg]);

  return (
    <>
      <StatusBar style={name === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bg } }}>
        <Stack.Screen name="(app)" />
        <Stack.Screen name="menu" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const [queryClient] = useState(makeQueryClient);
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ThemedStack />
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
