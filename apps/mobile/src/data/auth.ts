import { expoClient } from '@better-auth/expo/client';
import type { SourceKind } from '@morrow/core';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from './config';

/**
 * Better Auth client (SPEC §12.2). The expo plugin keeps the session cookie in SecureStore
 * (`morrow_cookie`), opens OAuth in an auth session and turns relative callback URLs into
 * `morrow://…` (or `exp://…/--/…` in Expo Go) deep links.
 */
export const authClient = createAuthClient({
  baseURL: `${API_URL}/api/auth`,
  plugins: [expoClient({ scheme: 'morrow', storagePrefix: 'morrow', storage: SecureStore })],
});

/** `cookie` header value for authenticated API calls ('' when signed out). */
export async function getAuthCookie(): Promise<string> {
  try {
    return await authClient.getCookie();
  } catch {
    return '';
  }
}

/** Sources that can be linked from the app in v0.2, with their OAuth provider + incremental scopes (§12.3). */
export const LINKABLE: Partial<Record<SourceKind, { provider: 'google' | 'spotify'; scopes: string[] }>> = {
  calendar: { provider: 'google', scopes: ['https://www.googleapis.com/auth/calendar.readonly'] },
  spotify: { provider: 'spotify', scopes: ['user-read-recently-played', 'user-top-read'] },
};

export const isLinkable = (kind: SourceKind) => kind in LINKABLE;

type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();
let signingOut: Promise<void> | null = null;

export function onSignedOut(l: UnauthorizedListener) {
  unauthorizedListeners.add(l);
  return () => {
    unauthorizedListeners.delete(l);
  };
}

/**
 * Sign out. The expo plugin clears the stored cookie + cached session before the request
 * leaves, so this works offline and after the server already dropped the session (401).
 */
export function signOut(): Promise<void> {
  if (!signingOut) {
    signingOut = authClient
      .signOut()
      .then(
        () => undefined,
        () => undefined,
      )
      .finally(() => {
        signingOut = null;
        for (const l of unauthorizedListeners) l();
      });
  }
  return signingOut;
}

/** A JSON API or chat call returned 401: the session is gone server-side → drop it locally. */
export function handleUnauthorized() {
  void signOut();
}
