import { useDemoMode } from '@/data/queries';
import { Txt } from './Txt';

/** Subtle mono marker shown while the app runs on fixtures (API unreachable). */
export function DemoBadge() {
  const demo = useDemoMode();
  if (!demo) return null;
  return (
    <Txt variant="label" color="textFaint" accessibilityLabel="Demo mode: showing sample data" style={{ fontSize: 10, lineHeight: 12 }}>
      DEMO
    </Txt>
  );
}
