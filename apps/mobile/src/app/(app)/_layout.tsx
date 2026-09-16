import { Stack } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';

export default function AppLayout() {
  const { palette } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bg } }} />;
}
