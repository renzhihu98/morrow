import {
  ApiError,
  ApiErrorCode,
  createApiClient,
  errorCodeForStatus,
  fixtures,
  FIXTURE_NOW_ISO,
  isApiError,
  type FetchLike,
  type Source,
  type TodayResponse,
} from '@morrow/core';
import { getAuthCookie, handleUnauthorized } from './auth';
import { API_URL, ONBOARDING_TIMEOUT_MS, REQUEST_TIMEOUT_MS } from './config';

/** Plain header object from any `HeadersInit`. */
export function headerRecord(init: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!init) return out;
  if (Array.isArray(init)) {
    for (const [k, v] of init) if (k !== undefined && v !== undefined) out[k] = v;
  } else if (typeof (init as Headers).forEach === 'function') {
    (init as Headers).forEach((v, k) => {
      out[k] = v;
    });
  } else {
    Object.assign(out, init);
  }
  return out;
}

/** Headers for an authenticated request: the Better Auth session cookie from SecureStore. */
export async function withAuthHeaders(init: HeadersInit | undefined): Promise<Record<string, string>> {
  const headers = headerRecord(init);
  const cookie = await getAuthCookie();
  if (cookie) headers.cookie = cookie;
  return headers;
}

/**
 * Global fetch with the session cookie and a timeout, so an unreachable dev server fails fast.
 * `credentials: 'omit'` keeps the native cookie jar out of it; a 401 signs out locally.
 */
function authedFetchWithTimeout(timeoutMs: number): FetchLike {
  return async (input, init) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers = await withAuthHeaders(init?.headers);
      const res = await fetch(input, { ...init, headers, credentials: 'omit', signal: controller.signal });
      if (res.status === 401) handleUnauthorized();
      return res;
    } finally {
      clearTimeout(timer);
    }
  };
}

const authedFetch = authedFetchWithTimeout(REQUEST_TIMEOUT_MS);

export const api = createApiClient({ baseUrl: API_URL, fetch: authedFetch });

/**
 * v0.2 account endpoints (SPEC §12). Typed here until `@morrow/core` ships them.
 * `GET /api/me` → user + sources.
 */
export type MeUser = {
  id: string;
  name: string;
  email: string | null;
  image: string | null;
  timezone: string | null;
  onboardedAt: string | null;
};
export type MeResponse = { user: MeUser; sources: Source[] };

async function json<T>(method: string, path: string, body?: unknown, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  let res: Response;
  try {
    res = await authedFetchWithTimeout(timeoutMs)(`${API_URL}${path}`, {
      method,
      headers: { accept: 'application/json', ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new ApiError(0, 'network_error', e instanceof Error ? e.message : String(e));
  }
  if (!res.ok) {
    let code = errorCodeForStatus(res.status);
    let message: string | undefined;
    try {
      const data = (await res.json()) as { error?: { code?: string; message?: string } };
      message = data?.error?.message;
      const parsed = ApiErrorCode.safeParse(data?.error?.code);
      if (parsed.success && parsed.data !== 'unknown' && res.status !== 409 && res.status !== 429) code = parsed.data;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, code, message);
  }
  if (res.status === 204) return { ok: true } as T;
  return (await res.json()) as T;
}

export const accountApi = {
  getMe: () => json<MeResponse>('GET', '/api/me'),
  setTimezone: (timezone: string) => json<unknown>('POST', '/api/me/timezone', { timezone }),
  /** Marks `onboardedAt`, runs the first sync and draws today's reading. Can take a while. */
  completeOnboarding: () => json<TodayResponse>('POST', '/api/onboarding/complete', undefined, ONBOARDING_TIMEOUT_MS),
};

/** Demo `/api/me`: Iris, already onboarded. */
export const meFixture = (): MeResponse => ({
  user: {
    id: fixtures.api.today.user.id,
    name: fixtures.api.today.user.name,
    email: null,
    image: null,
    timezone: fixtures.api.today.user.timezone,
    onboardedAt: FIXTURE_NOW_ISO,
  },
  sources: fixtures.api.sources.sources,
});

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
