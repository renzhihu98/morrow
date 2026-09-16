# @morrow/mobile

Expo (SDK 57) + Expo Router client for Morrow. It talks to the API hosted by `apps/web`, and runs fully offline on the shared fixtures when that API can't be reached.

## Run it

```bash
pnpm install                                   # from the repo root
pnpm --filter @morrow/mobile start             # Metro; press i for the iOS Simulator, a for Android
# or
pnpm --filter @morrow/mobile ios               # starts Metro and opens the iOS Simulator (Expo Go)
```

- **Simulator:** it uses Expo Go by default. Every native module in the app ships with Expo Go SDK 57, so you don't need a dev build.
- **Device:** install Expo Go and scan the QR code from `expo start`. Set `EXPO_PUBLIC_API_URL` to your machine's LAN IP, because `localhost` on the phone is the phone itself.
- **Dev build (optional):** `npx expo run:ios` generates `ios/`. That folder is gitignored.

## API URL

| Variable | Default | Notes |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `http://localhost:3000` | Base URL of `apps/web`. Copy `.env.example` to `.env.local`. |

JSON calls use `createApiClient` from `@morrow/core` with a 4 s timeout. Chat uses `useChat` (`@ai-sdk/react`) with `DefaultChatTransport` and `expo/fetch` against `POST /api/chat`. It sends only the newest message (SPEC §10) and renders `data-step`, `data-observation` and `data-quota` parts. A `409` puts the composer in its sealed state ("Today's reading →" refetches today). A `429` puts it in its limit state.

## Sign in & onboarding (v0.2, SPEC §12)

- **Auth:** `src/data/auth.ts` creates a Better Auth client (`better-auth/react`) against `${EXPO_PUBLIC_API_URL}/api/auth` with `expoClient({ scheme: "morrow", storagePrefix: "morrow", storage: SecureStore })`. The session cookie lives in SecureStore. Sign-in is Google only (`authClient.signIn.social`), and the flow runs in an in-app auth session (`expo-web-browser`).
- **Gate:** `src/data/session.tsx` works out a status from `useSession()` and `GET /api/me`, and `src/app/_layout.tsx` maps it onto protected route groups. Signed out goes to `(auth)/sign-in`. Signed in with `onboardedAt` null goes to `(auth)/sources`. Everyone else goes to `(app)`.
- **Connect accounts:** Calendar and Spotify use `authClient.linkSocial` with incremental scopes. "Draw my first reading →" and "Skip for now" call `POST /api/onboarding/complete`. Today shows the orbit in its `reading` state until that response arrives.
- **Authenticated calls:** JSON calls (`createApiClient` with a custom fetch) and chat (`expo/fetch`) both send `cookie: await authClient.getCookie()` with `credentials: "omit"`. A `401` signs you out locally and returns you to sign-in. On sign-in the app sends the device timezone once (`POST /api/me/timezone`).
- **Sources screen:** Connect uses `linkSocial`. Disconnect calls `DELETE /api/sources/[kind]`.

### Google sign-in on a device or simulator

- The web server (`apps/web`) must be running with Better Auth configured: `GOOGLE_CLIENT_ID/SECRET`, `SPOTIFY_CLIENT_ID/SECRET`, `BETTER_AUTH_SECRET`, `DATABASE_URL`.
- On a **physical device**, set `EXPO_PUBLIC_API_URL=http://<your LAN IP>:3000`, because `localhost` on the phone is the phone. The server's `BETTER_AUTH_URL` must match an origin the phone can reach, and its OAuth redirect URIs must be registered for that origin.
- The server must trust the app's deep links: `morrow://` for dev and production builds, and `exp://` while running in Expo Go.
- Bundle ID / package: `com.morrow.app`. Scheme: `morrow`.

## Demo / offline mode

If a request fails with a network error (no server, wrong host, timeout), the app switches to **demo mode**. A `401` never triggers demo mode. When the server can't be reached before sign-in, the sign-in screen shows **CAN'T REACH MORROW · EXPLORE THE DEMO →**. In demo mode, the menu's account row reads **SIGN IN**, and tapping it leaves demo mode.

- Queries resolve to `fixtures.api` from `@morrow/core`, which contains the Iris story from 09.16 to 09.30.
- Chat plays a scripted UI-message stream built on the device (`src/lib/chat-protocol.ts → demoScript`). It has the same parts as the server's demo mode: Calendar done → Spotify active → Past readings pending, then the fixture answer.
- "Forget this fact" and "Forget everything" act on in-memory copies.
- A faint mono `DEMO` label sits beside the wordmark.

Other errors, like `404` or `500`, are still shown as errors.

## Structure

```
src/
  app/                    Expo Router routes
    _layout.tsx           fonts + splash, QueryClient, ThemeProvider, auth gate → protected (auth) / (app) groups
    +native-intent.tsx    deep links (OAuth returns never route with the cookie param)
    (auth)/sign-in.tsx    13 sign in · (auth)/sources.tsx 14 connect accounts
    menu.tsx              08 menu sheet
    (app)/index.tsx       Today: 01 invocation · 03 fulfilled · 02/06/07 conversation
    (app)/readings/       04 archive · [date] 05 sealed reading
    (app)/prophecies.tsx  09
    (app)/sources/        10 sources · dossier 11 (readable ↔ raw JSON, forget a fact) · forget 12
  components/             Header, Orbit (+ MiniOrbit, FadingOrbit), Composer, Reading (TurnLabel, EvidenceLine,
                          ProphecyPanel, ProphecyCard/WindowBar, ReadingSteps, IndexList, RecordMarks),
                          Transcript, SourceRow, DossierRow, ConfirmInput, Page
  data/                   auth client, session gate, api client (cookie + 401) + demo fallback, TanStack Query hooks,
                          useMorrowChat transport
  lib/                    pure helpers (format, chat protocol + demo script) with jest tests
  theme/                  ThemeProvider (system + persisted override), fonts, type scale helpers
```

- **Tokens:** colors and type come from `@morrow/tokens`. Type sizes use the mobile scale, and the em letter-spacing is converted to px.
- **Theme:** follows the OS. Menu → Settings cycles System / Dark / Light, and the choice is saved in AsyncStorage. If storage fails, the app follows the OS.
- **Fonts:** Instrument Serif 400, Geist 400/500 and Geist Mono 400 come from `@expo-google-fonts/*`. Only those weights are bundled. The splash screen stays up until they load.
- **Monorepo:** Metro uses the default `expo/metro-config`, which handles pnpm workspaces automatically on SDK 52+, so `@morrow/*` resolves from its TS source.

## Checks

```bash
pnpm --filter @morrow/mobile typecheck
pnpm --filter @morrow/mobile test          # jest-expo, pure helpers
npx expo-doctor                            # from apps/mobile
npx expo export --platform ios             # bundle smoke test
```
