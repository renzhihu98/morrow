import {
  ApiError,
  createApiClient,
  fixtures,
  isApiError,
  type FetchLike,
} from '@morrow/core';
import { API_URL, REQUEST_TIMEOUT_MS } from './config';

/** Global fetch with a timeout so an unreachable dev server fails fast. */
const fetchWithTimeout: FetchLike = async (input, init) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

export const api = createApiClient({ baseUrl: API_URL, fetch: fetchWithTimeout });

/** Errors that mean "no API here" → use demo fixtures. */
export function isUnreachable(e: unknown): boolean {
  return isApiError(e) ? e.status === 0 : e instanceof TypeError;
}

type DemoListener = (demo: boolean) => void;
let demoMode = false;
const listeners = new Set<DemoListener>();

export function setDemoMode(next: boolean) {
  if (demoMode === next) return;
  demoMode = next;
  for (const l of listeners) l(next);
}
export const isDemoMode = () => demoMode;
export function subscribeDemoMode(l: DemoListener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Run an API call; if the server is unreachable, switch to demo mode and use `fallback`. */
export async function withFallback<T>(call: () => Promise<T>, fallback: () => T): Promise<T> {
  if (demoMode) return fallback();
  try {
    const result = await call();
    return result;
  } catch (e) {
    if (isUnreachable(e)) {
      setDemoMode(true);
      return fallback();
    }
    throw e;
  }
}

/** Retry the real API (e.g. pull-to-refresh after starting the web server). */
export async function probeApi(): Promise<boolean> {
  try {
    await api.getToday();
    setDemoMode(false);
    return true;
  } catch (e) {
    if (!isUnreachable(e)) {
      setDemoMode(false);
      return true;
    }
    return false;
  }
}

export function readingDetailFixture(date: string) {
  const detail = fixtures.api.readingDetails[date];
  if (!detail) throw new ApiError(404, 'not_found', `No reading on ${date}`);
  return detail;
}
