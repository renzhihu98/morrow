# @morrow/web

Next.js 16 (App Router) web app for Morrow: every screen from the Paper designs (v2 + onboarding 13/14), all API routes (SPEC §7, §10, §12), auth, source sync and the cron jobs. Mobile (`apps/mobile`) is a client of this API.

## Run

```sh
pnpm install                              # from the repo root
vercel env pull apps/web/.env.local       # real mode (optional — demo mode needs nothing)
pnpm --filter @morrow/web dev             # http://127.0.0.1:3000 (bound to 127.0.0.1 for OAuth redirect URIs)
pnpm --filter @morrow/web typecheck       # next typegen + tsc
pnpm --filter @morrow/web test            # vitest (aggregates/facts from API fixtures, sync, grounding, verify, taboo, views)
pnpm --filter @morrow/web build

pnpm --filter @morrow/web db:migrate      # apply drizzle/*.sql to DATABASE_URL (reads .env.local)
pnpm --filter @morrow/web db:generate     # after editing lib/db/schema.ts
pnpm --filter @morrow/web db:studio

# dev only (refuse NODE_ENV=production; read .env.local; --user <id> | --email <address>, or the only onboarded user)
pnpm --filter @morrow/web sources:resync  # run the normal sync + dossier rebuild for one user, print counts only
pnpm --filter @morrow/web reading:redraw  # delete today's reading (messages + prophecies made in it) and draw it again
```

## Modes

| | Demo mode | Real mode |
| --- | --- | --- |
| Trigger | `DATABASE_URL` unset | `DATABASE_URL` set |
| Data | In-memory fixtures (Iris, 09.30) | Postgres (Neon) via Drizzle, every row keyed to a Better Auth user |
| Auth | None — one implicit user; `/api/auth/*` → 404, `/sign-in` → `/` | Better Auth, Google sign-in; proxy + guards (below) |
| Sources | Connect/disconnect flips fixture status | Google Calendar + Spotify via Better Auth `linkSocial`, hourly sync |
| Model | Scripted chat stream + dossier templates (no key needed) | Sonnet 5 / Haiku 4.5 via AI Gateway (`AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN`); without either, templated readings and a short "offline" chat answer — never the demo script |

## Environment (SPEC §12.5)

See the root `.env.example`. Local values come from `vercel env pull apps/web/.env.local` — don't hand-write secrets.

| Variable | Used for |
| --- | --- |
| `DATABASE_URL` | Neon Postgres. Switches on real mode. |
| `BETTER_AUTH_SECRET` | Session signing **and** OAuth token encryption (`account.encryptOAuthTokens`). Rotating it invalidates stored grants. |
| `BETTER_AUTH_URL` | `http://127.0.0.1:3000` locally (Spotify rejects `localhost`), production URL when deployed. |
| `GOOGLE_CLIENT_ID/SECRET` | Google sign-in + Calendar linking. Provider is only registered when both are set. |
| `SPOTIFY_CLIENT_ID/SECRET` | Spotify linking. |
| `AI_GATEWAY_API_KEY` / `VERCEL_OIDC_TOKEN` | AI Gateway auth. |
| `CRON_SECRET` | `/api/cron/*` require `Authorization: Bearer <secret>` (open outside production when unset). |

OAuth redirect URIs to register:

- Google: `http://127.0.0.1:3000/api/auth/callback/google` (+ `https://<prod>/api/auth/callback/google`). Enable the Google Calendar API; add scope `https://www.googleapis.com/auth/calendar.readonly` to the consent screen.
- Spotify: `http://127.0.0.1:3000/api/auth/callback/spotify` (+ production). Add test users while the app is in development mode.

## Auth & API contract (web ⇄ mobile)

**Better Auth** at `/api/auth/[...all]` (basePath `/api/auth`, Drizzle adapter, `nextCookies()` + `@better-auth/expo` server plugins).

- Sign-in: `signIn.social({ provider: "google" })`, scopes `openid email profile` only. Any other sign-in provider → 400.
- `trustedOrigins`: `morrow://`, `BETTER_AUTH_URL`, `https://$VERCEL_URL`; in dev also `exp://`, `exp://**`, `http://127.0.0.1:3000`, `http://localhost:3000`, `:8081`.
- User `additionalFields` (server-set, `input: false`): `timezone` (string, null → treated as `UTC`), `onboardedAt` (date).
- Sessions: DB-backed cookies (no cookie cache). Mobile: Expo client plugin sends the stored cookie; the same session guards apply.
- **Linking sources** (`linkSocial` → `POST /api/auth/link-social`): a server hook enforces scopes whatever the client sends —
  - `provider: "google"` → `https://www.googleapis.com/auth/calendar.readonly` + `access_type=offline`, `prompt=consent` (refresh token). Links onto the sign-in Google account (scopes are merged).
  - `provider: "spotify"` → `user-read-recently-played user-top-read`.
  - Account linking is explicit only (`disableImplicitLinking`), different emails allowed, `google`/`spotify` trusted.
  - Mobile calls `authClient.linkSocial({ provider, callbackURL: "morrow://…" })` directly; the result is identical to the web flow.
- When the OAuth callback stores a source grant, a database hook schedules the first sync with `after()` — the redirect is not delayed.

**Guards.** `proxy.ts` (Next 16) — only when `DATABASE_URL` is set — lets `/sign-in`, `/api/auth/*`, `/api/cron/*` through, redirects pages without a session cookie to `/sign-in?next=…` and answers APIs with `401 { error: { code: "unauthorized", message } }`. Pages then verify the session for real (`requirePageUser`) and send users without `onboardedAt` to `/welcome/sources`; route handlers use `authed()` (401 on a missing/expired session).

Session-authenticated JSON APIs (shapes in `@morrow/core`, SPEC §7/§10):

| Method & path | Body → response |
| --- | --- |
| `GET /api/me` | → `MeResponse { user: { id, name, email, image, timezone, onboardedAt }, sources: Source[] }` |
| `POST /api/me/timezone` | `{ timezone }` (IANA) → `{ ok: true }` · `400 bad_request` for an unknown zone. Rebuilds the dossier when the zone changes. |
| `POST /api/onboarding/complete` | → `TodayResponse`. Marks `onboardedAt`, syncs linked sources not synced in the last 10 min, builds the dossier, creates today's reading + opening (Sonnet 5). Up to ~60 s. |
| `POST /api/sources/[kind]/connect` | `{ callbackURL? }` (default `/sources`) → `ConnectSourceResponse { kind, url, authorizeUrl }` (same URL; navigate to it). `calendar`/`spotify` only; `mail`/`instagram` → 400. Demo: linked immediately, `url: null`. |
| `DELETE /api/sources/[kind]` | → `{ ok: true }`. Spotify: account row deleted. Calendar: token revoked at Google, tokens + calendar scope removed (the Google sign-in account stays). Then the source's raw events + sync state are deleted and the dossier rebuilt. |
| `GET /api/today` · `GET /api/readings` · `GET /api/readings/[date]` · `GET /api/prophecies` · `GET /api/sources` · `GET /api/dossier` · `DELETE /api/dossier/facts/[id]` · `POST /api/forget` · `POST /api/chat` | unchanged shapes, now per signed-in user. `forget` also disconnects Calendar/Spotify and resets `onboardedAt`. |

Timezone: the sign-in page sets a 10-minute `morrow_tz` cookie that a Better Auth user-create hook stores, so new accounts start local; `TimezoneSync` (onboarding + app layout) posts the browser zone whenever it differs from the stored one.

`Source` gains optional `syncState` (`pending | syncing | ok | needs_reauth | error`), `eventCount` and (Calendar) `calendarCount` for linked sources. `status` is `error` when the grant needs reconnecting (`syncState: "needs_reauth"`) or the last sync failed; `stat` is `{ value: eventCount, label: "events" | "plays" }`.

## Pipeline (SPEC §12.3–12.4)

```
OAuth callback ─(after)─┐
/api/cron/sync hourly ──┼─▶ lib/sources/sync.ts
onboarding/complete ────┘      ├─ tokens.ts         Better Auth getAccessToken (refresh + re-encrypt); failure → needs_reauth
                               ├─ google-calendar.ts calendarList (ids + roles) → events.list on every calendar except Google-
                               │                     generated ones (holidays, birthdays, week numbers) and freeBusyReader;
                               │                     403/404 calendars skipped; −90d…+30d, singleEvents, showDeleted, pageToken,
                               │                     fields= whitelist (start/end, created/updated, status, organizer, iCalUID,
                               │                     attendees email/name/response, recurringEventId, originalStartTime, summary);
                               │                     copies deduped by iCalUID + start (own calendar wins)
                               ├─ spotify.ts         recently-played (after cursor, ≤50/page, follows next) + top artists/tracks
                               │                     (short term) + top artists (medium term, for "new in rotation")
                               ├─ raw_events         new/changed items only, expires_at = +24h (never extended)
                               ├─ dossier/aggregates.ts  incremental folds stored in dossiers.aggregates (survive the purge):
                               │                     calendar event index + moves, contact names; plays per UTC hour (instants
                               │                     only — local days derived at build time in the current zone), artists,
                               │                     top items; forgotten fact ids. `version` 2 (v1 Spotify days are dropped)
                               └─ dossier/build.ts   facts.ts (deterministic, ids = evidence refs) + patterns.ts (Haiku 4.5
                                                     structured output, only when facts changed; skipped without a model)
```

Facts (human phrasing — parts of the day, never clock times or averages): `people.<contact>` (moves with dates + usual weekday, meeting cadence, last met), `rhythms.first_activity` (part of day the first weekday thing lands + trend vs last month, Calendar + Spotify), `rhythms.protected_time` (recurring slot never moved/cancelled), `rhythms.slipping_slot`, `rhythms.busiest_day`, `rhythms.late_nights` (plays 23:00–04:00), `tastes.top_artists`, `tastes.new_in_rotation`, `tastes.returns_to`. Events on calendars the user only reads (`sh`) never count toward rhythms; their people only count when the user attends (matched by the user's own address — Google's `self` flags mean "this calendar"). Contact keys come from display name or email local part (`Sam Okafor` → `sam_okafor`) and are what prophecy `checkCondition.contact` uses.

Readings: `generateDailyReading` (Sonnet 5, `DailyReadingOutput`) → taboo filter + grounding check (`observation.evidenceRef` must resolve to a dossier fact/pattern id) → deterministic quality gate `reviewDraft` (no digits/clock times/metric words in the prophecy, no restating or extrapolating the cited fact, checkCondition must fit connected sources and dossier contacts) → Haiku 4.5 judge (human, hopeful, check matches statement; fails open) → up to two regenerations with specific feedback → last gate-passing draft, else a templated reading held to the same standard. `watching` is normalised to connected sources. Chat tools read only the user's dossier; `observe` refs are resolved against it.

Crons (`vercel.ts`): `sync` at :50 hourly (sync + purge expired raw events), `dawn` hourly (seal → summarize → open per user timezone), `verify` every 30 min (raw events + the calendar index, so a meeting booked days ago still fulfils `calendar_event_with`).

## Architecture

```
proxy.ts                      session-cookie gate (real mode)
app/
  (auth)/sign-in              screen 13
  (auth)/welcome/sources      screen 14 → FirstReading (orbit `reading`) → /
  (app)/layout.tsx            requirePageUser + TopBar (avatar → sign out) + TimezoneSync (posts browser zone when it differs)
  (app)/page.tsx, readings/, prophecies/, sources/…   screens 01–12
  api/auth/[...all]           Better Auth
  api/me, me/timezone, onboarding/complete, sources/…, today, chat, …
  api/cron/sync|dawn|verify
lib/
  auth/        auth.ts (Better Auth config, link scopes) · session.ts (getSessionUser, authed, requirePageUser) · grants.ts · client.ts
  db/          schema.ts (auth tables + Morrow tables) · client.ts (Neon HTTP)
  data/        Repository (user-scoped) · memory.ts (demo) · drizzle.ts
  sources/     google-calendar.ts · spotify.ts · sync.ts · tokens.ts · connect.ts · errors.ts · __fixtures__/ (API payloads)
  dossier/     aggregates.ts · facts.ts · patterns.ts · build.ts · extract.ts (raw-event extractors kept for Gmail)
  ai/          models · prompts · reading (grounding) · chat (tools, offline answer) · demo · taboo
  jobs/        sync · dawn · verify
drizzle/       0000_init.sql · 0001_auth_sources_aggregates.sql
```

Migration `0001_auth_sources_aggregates` starts with `DELETE FROM "users"` — the scaffold's demo user can't satisfy `users.email NOT NULL`; nothing else was ever stored for real users.

## Known gaps

- Real Google/Spotify OAuth has not been exercised end-to-end (no credentials during development); the Calendar/Spotify clients are tested against recorded-shape fixtures.
- Gmail and Instagram are listed as "later" and not connectable.
- Spotify's API has no "ms played"; `msPlayed` is the track duration.
- `listening_pattern` / `generic` prophecies can only expire — auto-fulfilment needs a Haiku classifier.
- Opening a new reading via "Draw today's reading" is revealed client-side (not persisted as a turn).
