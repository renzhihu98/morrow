import type { TodayResponse } from '@morrow/core';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { accountApi, isDemoMode, meFixture, setDemoMode, subscribeDemoMode, withFallback } from './api';
import { authClient, onSignedOut } from './auth';

/**
 * Where the root layout may send the user (SPEC §12):
 * - `loading`    session / profile not known yet (splash stays up)
 * - `signedOut`  → /(auth)/sign-in
 * - `onboarding` → /(auth)/sources (signed in, `onboardedAt` null)
 * - `ready`      → (app)
 * - `demo`       → (app) on fixtures, because the API is unreachable
 */
export type GateStatus = 'loading' | 'signedOut' | 'onboarding' | 'ready' | 'demo';

type Gate = {
  status: GateStatus;
  userId: string | null;
};

const GateContext = createContext<Gate>({ status: 'loading', userId: null });
export const useGate = () => useContext(GateContext);

export const meKey = (userId: string | null) => ['me', userId] as const;

/** `GET /api/me` for the signed-in user (fixture user in demo mode). */
export function useMe() {
  const { userId, status } = useGate();
  return useQuery({
    queryKey: meKey(userId),
    queryFn: () => withFallback(accountApi.getMe, meFixture),
    enabled: !!userId || status === 'demo',
    staleTime: 60_000,
  });
}

// --- First reading (onboarding step 3) -------------------------------------------------------

type FirstReading = { state: 'idle' | 'drawing' | 'error'; message: string | null };
let firstReading: FirstReading = { state: 'idle', message: null };
const firstReadingListeners = new Set<() => void>();
function setFirstReading(next: FirstReading) {
  firstReading = next;
  for (const l of firstReadingListeners) l();
}
const subscribeFirstReading = (l: () => void) => {
  firstReadingListeners.add(l);
  return () => {
    firstReadingListeners.delete(l);
  };
};
export const useFirstReading = () => useSyncExternalStore(subscribeFirstReading, () => firstReading);

/**
 * "Draw my first reading →" / "Skip for now": `POST /api/onboarding/complete`. The gate lets the
 * user into Today immediately (orbit in its `reading` state) and the response seeds today's query.
 */
export async function drawFirstReading(qc: QueryClient, userId: string | null) {
  if (firstReading.state === 'drawing') return;
  setFirstReading({ state: 'drawing', message: null });
  try {
    const today: TodayResponse = await accountApi.completeOnboarding();
    qc.setQueryData(['today'], today);
    await qc.refetchQueries({ queryKey: meKey(userId) });
    setFirstReading({ state: 'idle', message: null });
  } catch {
    setFirstReading({ state: 'error', message: "Morrow couldn't draw your reading yet. Try again." });
  }
}

// --- Gate provider ---------------------------------------------------------------------------

const deviceTimeZone = (): string | null => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
};

const SESSION_WAIT_MS = 6000;

export function GateProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const demo = useSyncExternalStore(subscribeDemoMode, isDemoMode, isDemoMode);
  const session = authClient.useSession();
  const drawing = useFirstReading().state === 'drawing';
  const userId = session.data?.user.id ?? null;

  // Don't keep the splash up forever if the auth server never answers.
  const [waitedTooLong, setWaitedTooLong] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setWaitedTooLong(true), SESSION_WAIT_MS);
    return () => clearTimeout(t);
  }, []);

  // Another account (or none): drop everything cached for the previous one.
  const prevUser = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (session.isPending && !session.data) return;
    if (prevUser.current !== undefined && prevUser.current !== userId) {
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
    }
    prevUser.current = userId;
  }, [qc, userId, session.isPending, session.data]);

  // 401 anywhere → local sign-out → refetch the session atom + clear cached data.
  useEffect(
    () =>
      onSignedOut(() => {
        qc.removeQueries();
        void authClient.getSession().catch(() => {});
      }),
    [qc],
  );

  const me = useQuery({
    queryKey: meKey(userId),
    queryFn: () => withFallback(accountApi.getMe, meFixture),
    enabled: !!userId && !demo,
    staleTime: 60_000,
  });

  // Capture the device timezone on sign-in (§12.4) when the server doesn't have it yet / it changed.
  const sentTz = useRef(new Set<string>());
  const serverTz = me.data?.user.timezone;
  useEffect(() => {
    if (demo || !userId || !me.data || isDemoMode()) return;
    const tz = deviceTimeZone();
    const key = `${userId}:${tz}`;
    if (!tz || serverTz === tz || sentTz.current.has(key)) return;
    sentTz.current.add(key);
    accountApi.setTimezone(tz).catch(() => sentTz.current.delete(key));
  }, [demo, userId, me.data, serverTz]);

  let status: GateStatus;
  if (demo) status = 'demo';
  else if (session.isPending && !session.data && !waitedTooLong) status = 'loading';
  else if (!userId) status = 'signedOut';
  else if (drawing) status = 'ready';
  // A non-401 profile error (e.g. 500) lets the user in; screens show their own error states.
  else if (!me.data) status = me.isError ? 'ready' : 'loading';
  else status = me.data.user.onboardedAt ? 'ready' : 'onboarding';

  return <GateContext.Provider value={{ status, userId }}>{children}</GateContext.Provider>;
}

/** Leave demo mode and re-check the server (menu "Sign in" while on fixtures). */
export function exitDemo(qc: QueryClient) {
  setDemoMode(false);
  qc.removeQueries();
  void authClient.getSession().catch(() => {});
}
