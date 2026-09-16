/** Base URL of apps/web, which hosts the API. Simulator: localhost; device: your LAN IP. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

/** JSON requests give up after this long and fall back to demo fixtures. */
export const REQUEST_TIMEOUT_MS = 4000;
