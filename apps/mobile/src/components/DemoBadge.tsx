import { useDemoMode } from '@/data/queries';
import { Txt } from './Txt';

/** Subtle marker shown while the app runs on fixtures (API unreachable). */
export function DemoBadge() {
  const demo = useDemoMode();
  if (!demo) return null;
  return (
    <Txt variant="label" color="textMuted" accessibilityLabel="Demo mode: showing sample data">
      Demo
    </Txt>
  );
}
