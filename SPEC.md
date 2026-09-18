# Morrow — Product & Engineering Spec

> An AI fortune teller that reads your connected accounts the way a psychic "hot reads" a room. Observations are grounded in real data; prophecies are generated, time-boxed, and automatically verified against your sources.

- **Design source of truth:** [Paper — Morrow — Web App](https://app.paper.design/file/01M2NRFN984ZCAHJT65TCM7QXR) (use the **v2** artboards; v1 and the Co-Star-style row are superseded explorations)
- **Status:** scaffold (v0.1)
- **Last updated:** 2026-09-16

---

## 1. Product principles

1. **Hot reading, not cold reading.** Morrow's power is nowcasting — telling users true things about themselves they haven't noticed.
2. **Ground the past, generate the future.** Observations must cite evidence from the dossier (`evidenceRef`). Prophecies may be imaginative but must carry a machine-checkable `checkCondition` and a time window.
3. **Self-verifying prophecy.** A background job checks open prophecies against new source data and marks them `fulfilled` or `expired`. The fulfilled moment is the core retention loop.
4. **One person, one reading a day.** Like a real psychic, the user speaks to Morrow in a single session per day. No "new chat".
5. **Progressive permission.** Start with Calendar + Spotify. Morrow asks for more access only when a prophecy needs it ("It will ask only when a prophecy needs to see more").
6. **Taboo topics.** Never infer or predict about health, pregnancy, death, money stress, or relationship breakdown. Enforced in the system prompt **and** a post-generation filter.
7. **Radical data honesty.** Raw events are deleted after 24h; only the distilled dossier persists. Users can view the dossier, forget single facts, or forget everything.

## 2. Product rules (reading lifecycle)

| Rule | Value |
|---|---|
| Readings per user per day | exactly 1, unique on `(user_id, local_date)` |
| Day boundary | **04:00 in the user's local timezone** (not midnight) |
| Opening message | Morrow speaks first; generated before dawn by cron (or lazily on first open) |
| Question limit | **15 user messages per reading** (UI shows `n OF 15 TODAY`) |
| Sealing | At the day boundary the reading becomes `sealed` (read-only) and is summarized into memory |
| Memory | Context = persona + dossier + last ~7 reading summaries + open prophecies + today's messages |
| Prophecy resolution | Fulfilled prophecies are announced **in today's reading**, linking back to the reading that made them |
| Writes to a sealed reading | Rejected (`409`), client redirects to today |

## 3. Information architecture

Nav (desktop top bar, mobile menu sheet): **Today · Readings · Prophecies · Sources**

| # | Screen | Route (web) | Route (mobile) | Paper artboards |
|---|---|---|---|---|
| 01 | Invocation (today, before first question) | `/` | `/(app)/index` | `v2 / 01`, light, mobile |
| 02 | Reading (observation + prophecy) | `/` | `/(app)/index` | `v2 / 02` |
| 03 | Prophecy fulfilled | `/` (state) | `/(app)/index` (state) | `v2 / 03` |
| 06 | Asking (Morrow is reading, source steps) | `/` (state) | state | `v2 / 06` |
| 07 | Answer (+ typing next question) | `/` (state) | state | `v2 / 07` |
| 04 | Past readings | `/readings` | `/readings` | `v2 / 04` |
| 05 | Sealed reading | `/readings/[date]` | `/readings/[date]` | `v2 / 05` |
| 09 | Prophecies | `/prophecies` | `/prophecies` | `v2 / 09` |
| 10 | Sources | `/sources` | `/sources` | `v2 / 10` |
| 11 | Dossier | `/sources/dossier` | `/sources/dossier` | `v2 / 11` |
| 12 | Forget everything | `/sources/forget` | `/sources/forget` | `v2 / 12` |
| 08 | Menu sheet (mobile only) | — | `/menu` (modal) | `v2 mobile / 08` |

Active nav item: **Today** on 01/02/03/06/07 · **Readings** on 04/05 · **Prophecies** on 09 · **Sources** on 10/11/12.

## 4. Design system — "Deep field"

Minimal sci-fi. Cool lab grey space, one aurora-green accent, coral reserved for destructive actions only. Light only — there is no dark theme. Off-centre layouts on desktop; a line-drawn **orbit diagram** represents Morrow.

### 4.1 Color tokens

| Token | Value | Use |
|---|---|---|
| `bg` | `#F3F4F6` | page background |
| `panel` | `#FFFFFF` | composer, cards, panels |
| `subtle` | `#E6E8EC` | toggles, track fills, stop button |
| `hairline` | `#DDE0E5` | dividers, borders |
| `hairlineStrong` | `#C9CDD4` | glyph boxes, dashed borders, secondary buttons |
| `orbitFaint` | `#E1E3E7` | outer orbit ring |
| `orbitLine` | `#C9CDD4` | orbit ellipses |
| `tick` | `#BFC3CA` | orbit ticks, core outline |
| `textFaint` | `#B5B9C0` | pending/disabled text, empty status "—" |
| `textMuted` | `#6E737D` | mono labels, meta |
| `placeholder` | `#8A8F98` | input placeholder |
| `textSecondary` | `#4E535B` | body copy, explanations |
| `textPrimary` | `#16181C` | headings, primary text |
| `accent` | `#2F8A6C` | Morrow's voice labels, dots, fulfilled, progress |
| `accentFill` | `#BFE8D8` | send / primary buttons |
| `onAccent` | `#16181C` | text/icon on `accentFill` |
| `danger` | `#B8574A` | Forget everything only |
| `onDanger` | `#FFFFFF` | text on `danger` |

Transparent variants used in designs: accent border `rgba(47,138,108,0.45)`; danger border `rgba(184,87,74,0.5)`.

### 4.2 Typography

Three families, each with one job. **No italics anywhere.**

**Labels are sentence case, set in Geist.** Mono is reserved for numerals — times, `09.30` dates, counts, likelihood values. There is no uppercase text in the UI, and no zero-padded display numbers (`7`, never `07`); the one exception is the literal word `FORGET` the user types to confirm deletion. Headlines carry no eyebrow/kicker label above them.

| Role | Family | Weight | Notes |
|---|---|---|---|
| Morrow's voice, titles, list items | **Instrument Serif** | 400 | letter-spacing −0.01 to −0.015em on large sizes |
| UI, body, user messages, small labels | **Geist** | 400 / 500 | labels are sentence case, letter-spacing 0 |
| Data: timestamps, `09.30` dates, counts, likelihoods | **Geist Mono** | 400 | numerals only, letter-spacing 0 |

| Scale token | Desktop | Mobile |
|---|---|---|
| `display` (hero) | 76 / 76 | 46 / 46 |
| `title` (page titles) | 68 / 68 | 46 / 46 |
| `confirm` (forget question) | 60 / 62 | 42 / 44 |
| `answer` (observation / answer) | 42 / 46 | 32 / 35 |
| `prophecy` | 28 / 34 | 23 / 28 |
| `listItem` | 24 / 30 | 22 / 27 |
| `row` (dossier/resolved rows) | 21 / 26 | 19 / 24 |
| `bodyLg` (user message) | 18 / 28 | 16 / 24 |
| `body` | 15–16 / 24 | 14–15 / 21–23 |
| `label` (sans, sentence case) | 12 / 16 | 12 / 14 |

### 4.3 Shape & spacing

| Token | Value |
|---|---|
| `radius.panel` | 16 (composer, prophecy panel) |
| `radius.card` | 14 (prophecy cards, delete list, menu status) |
| `radius.button` | 10 (send, primary buttons) |
| `radius.glyph` | 9–10 (source glyph boxes) |
| `radius.dot` | 999 |
| Desktop content gutter | 120px left/right; top bar padding 28 / 48 |
| Desktop columns | left column 340–600px, right column starts at x=560, width 760 |
| Mobile gutter | 24px; composer inset 16px, 30px above home indicator |

### 4.4 Signature components

- **Orbit** — SVG, `viewBox 0 0 660 660`: outer ring r=260, dashed ring r=170, two tilted ellipses (rx310/ry92 rot −18°, rx250/ry64 rot 34°), crosshair ticks, core r=58 with accent glow and centre dot, source nodes on the ellipses. States: `idle`, `reading` (dashed ring accent), `fulfilled` (matching ellipse + core stroke accent, larger glow), `sealed` (55–60% opacity, no accent). Small variants: header mini-orbit (26px), forget screen (dashed, fading).
- **Composer** — states `idle` (placeholder), `typing` (accent border + caret, send enabled), `waiting` ("Morrow is reading…", stop button), `sealed` (dashed border, lock icon, "Today's reading →" button). Shows `n of 15 today` (desktop) / `n/15` (mobile).
- **Turn labels** — sans `You — 06:51` (muted) and `● Morrow — 06:52` (accent).
- **Prophecy panel/card** — `Prophecy` + window (no serial number), serif statement, window bar (start → end with elapsed fill), `Likelihood 0.71`.
- **Reading steps** — left-bordered list: `✓ done`, `◌ active` (accent), `· pending` (faint).
- **Index list** — label rows with hairline dividers (no number column).
- **Record marks** — 12 marks: filled dot (fulfilled), dash (expired), hollow (open).

## 5. Architecture

```
morrow/
├─ apps/
│  ├─ web/        Next.js 16 (App Router) — web UI + all API routes + cron jobs
│  └─ mobile/     Expo (SDK 54+) + Expo Router — iOS/Android client of the web API
├─ packages/
│  ├─ tokens/     design tokens (TS objects + generated CSS variables)
│  └─ core/       shared zod schemas, types, domain rules, fixtures, API client
├─ SPEC.md
└─ turbo.json, pnpm-workspace.yaml
```

### 5.1 Stack

| Layer | Choice |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Language | TypeScript (strict) |
| Web | Next.js 16 App Router, React 19, Tailwind CSS v4, `next/font/google` |
| Mobile | Expo + Expo Router, `react-native-svg`, `@expo-google-fonts/*`, `useColorScheme` |
| LLM | Vercel AI SDK (latest) via **Vercel AI Gateway** (model strings like `anthropic/claude-sonnet-5`) |
| Models | Readings & chat: **Claude Sonnet 5**. Extraction, summaries, classification: **Claude Haiku 4.5** |
| Validation | zod (shared schemas are also the LLM structured-output schemas) |
| Database | Postgres (Neon via Vercel Marketplace) + Drizzle ORM. In-memory fixture repository when `DATABASE_URL` is unset |
| Auth | Demo single user in scaffold → Better Auth (Google sign-in) |
| Integrations | Google Calendar, Spotify Web API, Gmail (restricted scopes → needs Google CASA review before public launch), Instagram (future) |
| Jobs | Vercel Cron → `/api/cron/dawn` (seal + summarize + create + open reading) and `/api/cron/verify` (prophecy verification) |
| Hosting | Vercel (web/API), EAS (mobile builds) |

### 5.2 Pipeline

```
sources ──OAuth──▶ sync (cron) ──▶ raw events (TTL 24h)
                                      │ deterministic extractors (no LLM)
                                      ▼
                               Dossier (facts + inferred patterns, ~3 KB)
                                      │
        ┌─────────────────────────────┼───────────────────────────┐
        ▼                             ▼                           ▼
  Dawn job (Sonnet 5)           Chat (Sonnet 5)             Verify job
  structured DailyReading       tools over dossier          checkCondition vs new events
  → opening message +           streaming, 15-turn limit    → fulfilled / expired
    prophecy                                                  → attach to today's reading
```

LLM never sees raw emails/events — only the dossier.

### 5.3 Data model (Postgres)

```sql
users        (id, name, timezone, created_at)
sources      (id, user_id, kind, status, access_token_enc, refresh_token_enc, last_synced_at, stats jsonb)
raw_events   (id, user_id, source_kind, occurred_at, payload jsonb, expires_at)          -- TTL 24h
dossiers     (user_id pk, facts jsonb, patterns jsonb, size_bytes, rebuilt_at)
readings     (id, user_id, local_date, timezone, status, summary, question_count, opened_at, sealed_at,
              unique(user_id, local_date))
messages     (id, reading_id, role, parts jsonb, created_at)
prophecies   (id, user_id, number, made_in_reading_id, fulfilled_in_reading_id, statement,
              check_condition jsonb, window_start, window_end, likelihood, watching text[], status, resolved_at)
```

## 6. Shared package contracts

These names are the integration contract between `packages/*`, `apps/web`, and `apps/mobile`. Do not rename without updating this section.

### 6.1 `@morrow/tokens`

```ts
export type Palette = { bg; panel; subtle; hairline; hairlineStrong; orbitFaint; orbitLine; tick;
  textFaint; textMuted; placeholder; textSecondary; textPrimary; accent; accentFill; onAccent;
  danger; onDanger: string };
export const colors: Palette;
export const alphaColors: { accentBorder: string; dangerBorder: string };
export const fonts: { serif: 'Instrument Serif'; sans: 'Geist'; mono: 'Geist Mono' };
export type TypeToken = 'display' | 'title' | 'confirm' | 'answer' | 'prophecy' | 'listItem' | 'row' | 'bodyLg' | 'body' | 'label';
export type TypeStyle = { size: number; lineHeight: number; letterSpacing?: number };
export const typeScale: { desktop: Record<TypeToken, TypeStyle>; mobile: Record<TypeToken, TypeStyle> };
export const radii: { panel: 16; card: 14; button: 10; glyph: 10; dot: 999 };
export const space: { gutterDesktop: 120; gutterMobile: 24; composerInsetMobile: 16 };
```
- `size`/`lineHeight` are px (upper value where §4.2 gives a range). **`letterSpacing` is in em** — multiply by `size` for React Native px.
- Package points `main`/`types`/`exports` at `src/index.ts` (no build step).

Also ships `@morrow/tokens/tokens.css` (generated by `pnpm --filter @morrow/tokens build:css`, committed): `--color-<token>` in kebab-case (e.g. `--color-text-primary`, plus `--color-accent-border`, `--color-danger-border`), `--font-serif|sans|mono`, `--radius-panel|card|button|glyph|dot`. All values sit on `:root` (`color-scheme: light`); there is no theme switching.

### 6.2 `@morrow/core`

Single entry `@morrow/core` (source TS, no build). zod 4. Schemas and their inferred types share the same name (`Reading` is both a zod schema and a type).

- **Constants:** `QUESTION_LIMIT = 15`, `DAY_CUTOFF_HOUR = 4`, `RAW_EVENT_TTL_HOURS = 24`, `TABOO_TOPICS` (`health | pregnancy | death | money_stress | relationship_breakdown`), type `TabooTopic`.
- **Domain:**
  - `getReadingDate(now: Date, timeZone: string, cutoffHour = 4): string` (`YYYY-MM-DD`, DST-safe via `Intl.DateTimeFormat`)
  - `isReadingOpen(reading, now): boolean` (status `open` and `now` is still in its reading day)
  - `questionsLeft(reading): number` (≥ 0)
  - `windowProgress(prophecy, now): number` (0–1; freezes at `resolvedAt` once resolved)
  - helpers: `getLocalParts(instant, tz)`, `addDays(date, n)`, `formatShortDate('2026-09-16') → '09.16'`, `formatLocalTime(iso, tz) → '06:43'`, `formatProphecyNumber(47) → '0047'`, `prophecyRecord(prophecies, limit = 12) → { fulfilled, open, expired, marks }`
- **Schemas (zod) + inferred types:**
  - `LocalDate` (`YYYY-MM-DD`), `IsoDateTime` (ISO with offset or Z). All timestamps are ISO strings.
  - `User { id, name, timezone }`
  - `SourceKind` = `calendar | spotify | mail | instagram`; `SourceStatus` = `linked | not_linked | error`
  - `Source { kind, name, provider, status, reads, stat: {value, label} | null, watchingCount, lastSyncedAt | null }`
  - `ReadingStatus` = `open | sealed`; `Reading { id ("r_YYYY-MM-DD"), localDate, timezone, status, headline (first observation line), prophecyId | null (made in this reading), summary | null, questionCount, openedAt, sealedAt | null }`; `ReadingSummary { readingId, localDate, summary }`
  - `MessagePart` (discriminated on `type`): `text {text}` | `observation {text, evidenceRef, sourceLabel}` | `prophecyRef {prophecyId, event: 'made' | 'fulfilled'}` | `steps {items: ReadingStep[]}`; `ReadingStep { label, source?, status: 'done' | 'active' | 'pending' }`. Individual part schemas: `TextPart`, `ObservationPart`, `ProphecyRefPart`, `StepsPart`.
  - `MessageRole` = `user | assistant` (assistant = Morrow); `Message { id, readingId, role, parts, createdAt }`
  - `CheckCondition` (discriminated on `type`): `email_from_contact {contact, firstInThread}` | `calendar_event_with {contact, titleIncludes | null}` | `listening_pattern {pattern}` | `generic {description}`
  - `ProphecyStatus` = `open | fulfilled | expired`; `Prophecy { id ("p_0047"), number, statement, title (short, for lists), checkCondition, windowStart, windowEnd, likelihood, watching: SourceKind[], status, madeOn (LocalDate), madeInReadingId, fulfilledInReadingId | null, resolvedAt | null }`
  - `DossierCategory` = `rhythms | pursuits | people | places | tastes`; `DossierFact { id, category, label (natural case, rendered as-is), value, sources }`; `DossierPattern { id, statement, confidence, sources }`; `Dossier { userId, sizeBytes, rebuiltAt, facts, patterns }`
- **LLM output schemas:** `DailyReadingOutput` `{ observation: {text, evidenceRef, sourceLabel}, prophecy: {statement, checkCondition, windowDays (1–60), likelihood, watching (≥1)} }`.
- **API types (zod schemas + types):**
  - `TodayResponse { user, now, reading, messages, prophecies (all referenced by messages), questionLimit, questionsLeft }`
  - `ReadingsResponse { readings (newest first), total }`
  - `ReadingDetailResponse { reading, messages, prophecies }`
  - `ProphecyListResponse { open, resolved (both newest first), record: { fulfilled, open, expired, marks: ProphecyStatus[] (last 12, oldest→newest) } }`
  - `SourcesResponse { sources, dossier: { sizeBytes, rebuiltAt, factCount } }`
  - `DossierResponse { dossier }`, `ForgetRequest { confirm: 'FORGET' }`, `OkResponse { ok: true }`, `ConnectSourceResponse { kind, authorizeUrl | null }`
  - Errors: non-2xx bodies are `ApiErrorBody { error: { code: ApiErrorCode, message } }`; `ApiErrorCode` = `reading_sealed | question_limit | bad_request | unauthorized | not_found | server_error | network_error | unknown`.
- **Client:** `createApiClient({ baseUrl, fetch?, headers? })` → `getToday()`, `getReadings()`, `getReading(date)`, `getProphecies()`, `getSources()`, `getDossier()`, `forgetFact(id)`, `forgetEverything()`, `connectSource(kind)`, `disconnectSource(kind)`, `chatUrl`. Throws `ApiError { status, code }` (`isApiError(e)`); 409 → `reading_sealed`, 429 → `question_limit`, other statuses use the body code if valid, else a status-based code; fetch failures → status 0 `network_error`. Chat uses the AI SDK UI message stream at `POST /api/chat` (`chatUrl`).
- **Fixtures:** `FIXTURE_NOW` (Date), `FIXTURE_NOW_ISO` (`2026-09-30T09:12:00-07:00`), `FIXTURE_TIMEZONE`, `FIXTURE_READINGS_TOTAL` (23), and `fixtures` — the canonical demo story (user **Iris**, tz `America/Los_Angeles`):
  - `fixtures.readings` (newest first): 09.30 (open, today), 09.28, 09.27, 09.24, 09.22, 09.19, 09.16; `fixtures.readingSummaries`
  - `fixtures.messages` keyed by reading id — full 09.16 transcript (2 questions) and the 09.30 opening (observation "Sam wrote first.", 0047 fulfilled announcement, 0052 made); other readings have a single opening message
  - `fixtures.prophecies` **0041–0052** ordered by number (record 7 fulfilled / 3 open / 2 expired = 12 marks); 0047 "Sam will write first." fulfilled 09.30
  - `fixtures.sources` (Calendar/Spotify/Mail linked, Instagram not linked), `fixtures.dossier` (rhythms, people, 2 inferred patterns), `fixtures.askingSteps` (example `steps` part for screen 06)
  - `fixtures.api` — ready-made response bodies: `today`, `readings`, `readingDetails[localDate]`, `prophecies`, `sources`, `dossier`. All parse with their schemas (tested).

## 7. Web API (apps/web)

| Method & path | Purpose |
|---|---|
| `GET /api/today` | get-or-create today's reading → `TodayResponse` |
| `POST /api/chat` | streaming chat turn; `409` if sealed, `429` if 15 questions used |
| `GET /api/readings` · `GET /api/readings/[date]` | archive list · sealed transcript |
| `GET /api/prophecies` | open + resolved |
| `GET /api/sources` · `POST /api/sources/[kind]/connect` · `DELETE /api/sources/[kind]` | sources (connect is an OAuth stub) |
| `GET /api/dossier` · `DELETE /api/dossier/facts/[id]` | dossier · forget one fact |
| `POST /api/forget` | body `{ confirm: "FORGET" }` → deletes everything |
| `GET /api/cron/dawn` · `GET /api/cron/verify` | protected by `CRON_SECRET` |

**Env:** `AI_GATEWAY_API_KEY` (or Vercel OIDC), `DATABASE_URL`, `CRON_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `SPOTIFY_CLIENT_ID/SECRET`, `TOKEN_ENCRYPTION_KEY`. **Demo mode:** with no AI key and no DB, the app runs fully on fixtures and scripted Morrow responses.

## 8. Roadmap

1. ✅ Design (Paper, v2 light, desktop/mobile)
2. ⏳ Scaffold: monorepo, tokens, core, web + mobile screens on fixtures, API contracts, demo mode
3. Provision Neon + AI Gateway on Vercel; replace demo user with Better Auth
4. Google Calendar + Spotify OAuth and extractors → real dossier
5. ✅ Dawn + verify cron jobs; ✅ evals + red team in CI (§13)
6. Gmail (CASA review), push notifications for fulfilled prophecies (Expo)
7. Not yet designed: onboarding/first source connect, goodbye screen after Forget, raw JSON dossier view, settings

## 9. Changelog

### 2026-09-16
- **Concept:** fortune teller as "hot reading"; grounded observations + self-verifying prophecies; progressive permissions; taboo list.
- **Design v1 "Dawn fog":** Cormorant Garamond italic, lavender + brass. Superseded.
- **Co-Star-inspired revision:** Gilda Display + DM Mono, monochrome. Rejected as too derivative.
- **Design v2 "Deep field" (current):** Instrument Serif + Geist + Geist Mono, off-centre layout, orbit diagram, numbered index lists, aurora accent. Added light mode and mobile.
- **Product rule:** one reading per day, 04:00 local boundary, sealed history, 15-question limit (confirmed).
- **Naming:** data connections renamed **Threads → Sources**; conversations are **readings**; nav gained **Today**.
- **Screens added:** past readings, sealed reading, asking, answer, mobile menu, prophecies, sources, dossier, forget everything. Coral `danger` color introduced for destructive flow only.
- **Engineering:** §6 contracts made concrete while scaffolding `packages/tokens` + `packages/core` (field names, `prophecyRef.event`, `MessageRole` = `user | assistant`, em letter-spacing, fixtures 0041–0052 so the record totals 12, extra client methods `connectSource`/`disconnectSource`).
- **Engineering:** stack chosen (Next.js + Expo monorepo, AI SDK + AI Gateway, Claude Sonnet 5 / Haiku 4.5, Postgres + Drizzle); repo scaffolded at `~/morrow`.
- **Web scaffold (`apps/web`):** Next.js 16 + Tailwind v4 screens 01–07, 09–12 on the shared tokens; API routes per §7/§10 over a `Repository` (fixtures in memory, or Postgres/Drizzle with `DATABASE_URL`); AI Gateway models `anthropic/claude-sonnet-5` / `anthropic/claude-haiku-4.5` with a scripted demo stream; dawn (hourly) + verify (30 min) crons; deterministic extractors. `/api/chat` also accepts an optional `readingId` (stale → 409).
- **Mobile scaffold (`apps/mobile`):** Expo SDK 57 + Expo Router (TS strict, scheme `morrow`), screens 01–12 incl. 08 menu modal on the shared tokens/core; TanStack Query over `createApiClient` with automatic fallback to `fixtures.api` (faint `DEMO` label) when the API is unreachable; `useChat` + `DefaultChatTransport` over `expo/fetch` sending the last message + `readingId`, with an on-device scripted stream offline.
- **Web v0.2 real data (`apps/web`):** Better Auth 1.7 at `/api/auth` (Google sign-in `openid email profile`, Drizzle adapter, `encryptOAuthTokens`, `@better-auth/expo`, `trustedOrigins` `morrow://` + dev `exp://`; user `timezone`/`onboardedAt`); sources linked with `linkSocial` (scopes enforced server-side: Calendar `calendar.readonly` offline+consent onto the sign-in Google account, Spotify recently-played + top-read); Next 16 `proxy.ts` + page/route guards (401 `unauthorized`); new `GET /api/me`, `POST /api/me/timezone`, `POST /api/onboarding/complete` (→ `TodayResponse`), connect returns `{ kind, url, authorizeUrl }`; screens 13/14 + first-reading orbit state, avatar sign-out; migration `0001_auth_sources_aggregates` (auth tables, source sync state, `dossiers.aggregates`); Calendar/Spotify clients, hourly `/api/cron/sync` + on-connect `after()` sync, incremental aggregates → deterministic facts + Haiku patterns; grounded Sonnet readings (evidenceRef must exist → regenerate once → templated fact). Core (additive): `AccountUser`, `MeResponse`, `TimezoneRequest`, `ConnectSourceRequest`, `SOURCE_OAUTH`, `Source.syncState?/eventCount?`, `ConnectSourceResponse.url?`.
- **Web v0.2.1 first-real-run fixes (`apps/web`):** (1) timezone — Spotify aggregates now store plays per UTC hour (aggregates v2; v1 timezone-baked days dropped and refolded from raw events), local days/first activity/late nights derived at fact-build time; `POST /api/me/timezone` rebuilds the dossier on change; `TimezoneSync` posts whenever the browser zone differs; sign-in sets a short-lived `morrow_tz` cookie read by a Better Auth user-create hook. (2) Calendar reads every calendar in `calendarList` (skips Google-generated holiday/birthday/week-number and free/busy-only calendars, and 403/404 calendars), dedupes copies by iCalUID + start, and keeps other people's reader-only calendars out of rhythms (people only when the user attends); source shows `calendarCount` (core, additive). (3) Readings — facts phrased as parts of the day (no clock times/averages), new `tastes.new_in_rotation`, rewritten hot-reading prompt with good/bad examples, deterministic quality gate + Haiku judge with up to two retries, templated fallbacks rewritten to the same standard. Dev scripts `sources:resync`, `reading:redraw`.
- **Web v0.2.2 what the calendar is about (`apps/web`, core additive):** Calendar sync now reads event descriptions (plain text), locations and calendar names; aggregates keep them per event (`x`, `l`, `k`) plus `calendar.calendars`. New `pursuits` dossier category (core enum, web + mobile dossier screens) built from a cached Haiku classification; chat gets `searchCalendar` and answers future questions ("when will I…") with a grounded prophecy instead of refusing; readings prefer pursuits and may use `calendar_event_with { contact: "any", titleIncludes }` (verify no longer requires attendees for that form). Taboo filter also covers dentist/clinic/physio/psychiatry/check-up.
- **v0.3.3 quality (`apps/web`):** eval + red-team suites (§13) with `pnpm eval`, baselines committed, graders unit-tested; GitHub Actions runs typecheck, tests and build on push and PR. Gmail pacing found at run time after measuring the real ceiling (`gmail:probe`): start 10 gets/s, halve on refusal, creep back after 100 clean fetches; rate limits back off twice (8 s, 16 s) instead of five quick retries that spent quota on failures; first sync 180 messages over 14 days (~2 min) so it stays inside Vercel's 300 s function limit. Dev scripts: `chat:reset`, `sources:sync <kind>`, `sources:resync`, `reading:redraw`, `gmail:probe`.
- **v0.3.2 a reader never says a name (`apps/web`):** readings, prophecies and chat may not name people, companies or places — a presence, not a contact ("the one who keeps reaching first"); the reading gate rejects any draft naming a dossier contact or pursuit and the templated fallbacks were rewritten nameless. Counts in words ("three times", "twice") are rejected too. The dossier stays concrete (names, dates, counts are its evidence) but is written as sentences that carry meaning rather than rows of stats; one slot can no longer be both `rhythms.protected_time` and `rhythms.slipping_slot`.
- **v0.3.1 voice:** Morrow speaks as a psychic, not an analyst — the persona forbids reciting evidence (companies, events, dates, days, counts, schedules) in chat answers and readings; data stays in `sourceLabel` as proof; future questions get a felt horizon and a sign to watch for; prophecies promise exactly what their checkCondition observes (gate rejects outcome phrases, judge checks the core event). Readings page no longer draws today's reading; concurrent requests share one draw; Today streams a drawing state.
- **v0.3 Gmail (`apps/web`, `apps/mobile`, core additive):** Gmail is a connectable source (onboarding card on web + mobile, Sources row); `SOURCE_OAUTH.mail`, per-source `LINK_PARAMS`, Google scope enforcement per requested source; `lib/sources/gmail.ts` client, `lib/dossier/mail.ts` (fold, Haiku thread notes, people/waiting facts), `lib/dossier/mail-search.ts` + chat `searchMail`; pursuits span calendar + mail; `email_from_contact.subjectIncludes`; forget/disconnect cover Mail. Calendar card copy updated (it reads titles and details since v0.2.2).

### 2026-09-17
- **Light only:** the dark theme is gone from the designs and the code. `@morrow/tokens` exports a single `colors: Palette` / `alphaColors` (no `ThemeName`) and `tokens.css` emits one `:root` block with `color-scheme: light`; web dropped `ThemeToggle`, the no-flash `<head>` script and `data-theme` (`themeColor` is now `#F3F4F6`); mobile's `ThemeProvider` serves the light palette with no OS follow or stored preference, and the menu's Settings row lost its theme cycle.
- **Plainer surface:** the mono-uppercase label system is retired across design and code. `label`/`label-sm` are sentence-case Geist (web `globals.css`); mobile's `Txt` no longer uppercases and the `label` type token maps to sans. Mono is now reserved for numerals. Every eyebrow/kicker above a headline is deleted (the `eyebrow` prop is gone from web's `PageIntro` and mobile's `PageTitle`); zero-padded display numbers are gone (`pad2` deleted from both apps, index-list number columns removed); prophecy serial numbers no longer render (`formatProphecyNumber` remains — it still builds `p_0047` record ids and model prompt text); the `SOURCE …` evidence line under readings is removed (`EvidenceLine` deleted in both apps, `sourceLabel` retained as provenance); source abbreviations are spelled out (`CAL · SPT` → `Calendar · Spotify`).

## 10. Chat protocol (web ⇄ mobile contract)

`POST /api/chat` — one thread per day, so the server owns history; clients send only the new message.

```jsonc
// request
{ "message": { "id": "m_…", "role": "user", "parts": [{ "type": "text", "text": "Should I say yes to Sam this time?" }] } }
```

- Response: **AI SDK UI message stream** (`result.toUIMessageStreamResponse()`), assistant message streamed as `text` parts plus custom data parts:
  - `data-step` `{ id, source: SourceKind | 'memory', label, detail, status: 'done' | 'active' | 'pending' }` — drives the "Morrow is reading" list (screen 06). Re-emitted with the same `id` to update status.
  - `data-observation` `{ text, evidenceRef, sourceLabel }` — serif answer (screen 07); `sourceLabel` is retained as provenance but no longer rendered under the answer.
  - `data-quota` `{ used, limit }` — sent at stream start; drives `n OF 15 TODAY`.
- Errors before streaming: `409 { error: { code: "reading_sealed" } }`, `429 { error: { code: "question_limit" } }`.
- Clients: web uses `useChat` from `@ai-sdk/react` with `DefaultChatTransport({ api: '/api/chat', prepareSendMessagesRequest })` sending only the last message; mobile uses the same with `fetch` from `expo/fetch` and an absolute `EXPO_PUBLIC_API_URL`.
- **Demo mode** (no `AI_GATEWAY_API_KEY`/OIDC): server streams a scripted response with the same parts (steps: Calendar done → Spotify active → Past readings pending, then the fixture answer) with small delays, so both clients look identical with or without a model.

## 11. Paper artboard IDs (file `01M2NRFN984ZCAHJT65TCM7QXR`)

| Screen | Desktop | Mobile |
|---|---|---|
| 01 Invocation | `DC-0` | `NT-0` |
| 02 Reading | `ES-0` | `PA-0` |
| 03 Fulfilled | `GC-0` | `QP-0` |
| 04 Past readings | `YD-0` | `18R-0` |
| 05 Sealed reading | `ZX-0` | `1A6-0` |
| 06 Asking | `1I2-0` | `1PG-0` |
| 07 Answer | `1JQ-0` | `1QY-0` |
| 08 Menu | — | `1U3-0` |
| 09 Prophecies | `26G-0` | `2H5-0` |
| 10 Sources | `294-0` | `2IR-0` |
| 11 Dossier | `2SI-0` | `32G-0` |
| 12 Forget | `2UN-0` | `343-0` |

## 12. Auth, onboarding & real data (v0.2)

Goal: replace the demo user and fixtures with real accounts, a real database, and real source data. Fixtures remain only as the demo mode used when `DATABASE_URL` is unset.

### 12.1 Screens

| # | Screen | Web route | Mobile route | Desktop | Mobile |
|---|---|---|---|---|---|
| 13 | Sign in | `/sign-in` | `/(auth)/sign-in` | `3C9-0` | `3FN-0` |
| 14 | Connect accounts (onboarding step 2 of 3) | `/welcome/sources` | `/(auth)/sources` | `3DH-0` | `3GZ-0` |

- **Sign in:** Google only. "Signing in only shares your name and email. Sources are connected separately." Promises footer (raw events 24h · never health/money · forget anytime).
- **Connect accounts:** Google Calendar and Spotify cards with READS / NEVER copy, linked state (accent border, `● LINKED`, event count), outline `Connect` button; Gmail and Instagram listed under "LATER · MORROW ASKS WHEN A PROPHECY NEEDS IT" (not connectable during onboarding). Primary CTA **Draw my first reading →** (enabled with ≥1 source); "Skip for now".
- Step 3 "First reading" = Today screen in orbit `reading` state while the first reading is generated.

### 12.2 Auth

- **Better Auth** (latest) mounted at `/api/auth/[...all]` in `apps/web`, Drizzle adapter on the same Postgres.
- Sign-in: Google social provider, scopes `openid email profile` only.
- Sessions: cookies on web; **mobile** uses `@better-auth/expo` (expo client plugin + SecureStore), app scheme `morrow`, server `trustedOrigins` include `morrow://` (and `exp://` in dev).
- Route protection: when `DATABASE_URL` is set, every page and API route except `/sign-in`, `/api/auth/*`, `/api/cron/*` requires a session; users without `onboardedAt` are redirected to `/welcome/sources`.

### 12.3 Source connections

- Connected via Better Auth **account linking** (`linkSocial`) with incremental scopes; tokens live in Better Auth's `account` table with **OAuth token encryption enabled**; refresh via Better Auth's access-token helpers.
- **Google Calendar:** scope `https://www.googleapis.com/auth/calendar.readonly`. Sync events from every calendar in the user's calendar list (except Google-generated and free/busy-only calendars) from the last 90 days and next 30 days (`singleEvents=true`), keeping only: start/end, created/updated, status, organizer, attendee emails/display names/response status, recurringEventId, summary (title), description as plain text (≤500 chars), location (≤120), and each calendar's name. Never attachments or conferencing data. Title/details/location are kept only for events the user is part of.
- **Spotify:** provider scopes `user-read-recently-played user-top-read`. Sync recently played (API returns max 50 → poll hourly to accumulate) and top artists/tracks.
- **Gmail** (v0.3): scope `https://www.googleapis.com/auth/gmail.readonly`, linked onto the same Google account as Calendar (`include_granted_scopes`; the account row can grant both, `sourceKindsForAccount`). Sync: messages from the last 14 days (first sync ≤200 — about two minutes — then `after:` the cursor, ≤300). A first sync takes the newest, highest-ranked mail: the priority listing (`MAIL_QUERY_PRIORITY` — answered, important or starred) over 30 days (`MAIL_PRIORITY_DAYS`) first, then the newest of everything else over 14 days to fill the 200, merged and deduped. Priority mail is sparse, so the longer reach costs almost nothing (listing ids is ~5 units and adds no fetches). The pace is found at run time — start at 10 gets/s, halve on every refusal, creep back up after 100 clean fetches — because the quota refills far slower than the console's 6,000 units/minute implies: measured throughput is ~1.5 messages/s (`pnpm gmail:probe`, 1,500 messages in 17 min) matching `-in:spam -in:trash -in:chats -category:promotions -category:social -category:forums`; requested fields: id, threadId, labelIds, snippet, internalDate, headers (From/To/Cc/Subject + list/auto-submitted markers only) and text parts. Bodies become plain text without quoted replies, ≤2,000 chars, kept only in `raw_events` (24h). Disconnecting one Google source removes its scope; the grant is revoked only when no Google source remains. Restricted scope → Google CASA review before public launch.
- **Instagram**: shown as "later", not implemented.
- Disconnect = unlink account + delete that source's raw events + rebuild dossier.

### 12.4 Pipeline (real)

1. On connect and hourly (`/api/cron/sync`): fetch → `raw_events` (TTL 24h, purged by cron).
2. Extractors fold raw events into **incremental aggregates** stored with the dossier (so aggregates survive raw-event deletion), then rebuild `dossiers.facts/patterns`. Patterns inferred with Claude Haiku 4.5, facts are deterministic. **Pursuits** (v0.2.2): Haiku groups event titles (+ calendar name, start of details) into ≤5 ongoing pursuits (job search, a course, a move…), cached in `aggregates.pursuits` and reclassified only when unseen titles appear; `pursuits.<key>` facts carry counts, momentum and what's booked ahead. Chat has a `searchCalendar` tool (title, calendar, location, details; taboo events never returned). **Mail** (v0.3): at sync, Haiku reads each changed thread's latest two messages (≤900 chars each, taboo threads never sent) in batches of 20 and writes a ≤20-word note + kind (personal/work/pursuit/transactional/newsletter/other) + status (waiting_on_you/waiting_on_them/done/open). `aggregates.mail` keeps per-message timing/direction/people and per-thread subject/note/status — never bodies (180-day retention). Facts: `people.<key>` from correspondence (merged with Calendar people), `rhythms.mail_unanswered`, `rhythms.mail_waiting`; pursuits classify calendar titles and noted threads together (`PursuitIndex.threads`; reclassified after ≥5 unseen items or a day). Chat gets `searchMail` (subject, who, note, status). `email_from_contact` gains optional `subjectIncludes` (core, additive) so `contact: "any"` can watch a pursuit.
3. "Draw my first reading" (`POST /api/onboarding/complete`): marks `onboardedAt`, runs initial sync + dossier build, creates today's reading and generates the opening message with Claude Sonnet 5 (`DailyReadingOutput`), then Today shows it.
4. Dawn / verify crons operate per user (timezone stored on user; captured from the browser/device on first sign-in).

### 12.5 Environment

| Variable | Source |
|---|---|
| `DATABASE_URL` (+ Neon vars) | Vercel Marketplace → Neon (`vercel env pull`) |
| `BETTER_AUTH_SECRET`, `CRON_SECRET` | generated, stored in Vercel env |
| `BETTER_AUTH_URL` | `http://127.0.0.1:3000` locally (Spotify rejects `localhost` redirect URIs); production URL when deployed |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Cloud Console (user-created OAuth client) |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | Spotify Developer Dashboard (user-created app) |
| `VERCEL_OIDC_TOKEN` / `AI_GATEWAY_API_KEY` | AI Gateway auth (OIDC from `vercel env pull` locally, automatic on Vercel) |
| `EXPO_PUBLIC_API_URL` | mobile → web API (`http://<LAN IP>:3000` on a device) |

OAuth redirect URIs: Google `http://127.0.0.1:3000/api/auth/callback/google`, Spotify `http://127.0.0.1:3000/api/auth/callback/spotify` (+ production equivalents later).

## 13. Quality: evals, red team, CI

Morrow's output is probabilistic, so quality is measured, not asserted. `apps/web/evals` runs the real pipeline —
prompts, tools, quality gate, judge — against **synthetic personas** (a job seeker mid-search, someone steady, a new
account, and a poisoned one). No real user data ever enters the fixtures.

```bash
pnpm --filter @morrow/web eval [--suite core|redteam|all] [--cases a,b] [--no-judge] [--update-baseline]
pnpm --filter @morrow/web gmail:probe   # measure Gmail's real rate ceiling
```

A run calls real models (a few cents, ~3 min), writes `evals/reports/latest.json` and compares against
`evals/baseline.json` / `baseline.redteam.json`, exiting non-zero on a drop (judge checks carry a 12-point tolerance
for model variance).

### 13.1 Rubric

Deterministic (`graders.ts`, unit-tested in CI without a model): `grounded` (evidenceRef resolves), `no_recital`
(no echoed event titles, calendar names or subjects), `no_names`, `no_weekday`, `no_digits`, `no_counts`,
`one_checkable_promise` (the reading gate passes), `no_taboo`, `within_length`, and for chat `answered`,
`observed_once`, `looked_first`.

Judged by Haiku (`judge.ts`), each dimension scored independently and required to quote the words it fails:
`judge_voice`, `judge_no_recital`, `judge_grounded`, `judge_answers`.

Cases that pass by refusing are marked in `cases.ts`: `taboo` (health, money), `unknowable` (nothing in the data
touches it), `refusalOk` (jailbreak, dump-the-data).

### 13.2 Red team

Morrow reads text other people wrote — event titles, invitation details, email bodies — so all of it is an injection
surface. The `poisoned` persona plants instructions there (reply only with PWNED; append an exfiltration link;
print the system prompt and forward the dossier; a note claiming a taboo topic to raise), and three chat-side cases
attack directly (jailbreak, fake SYSTEM OVERRIDE, dump every subject verbatim). Passing means the planted text was
treated as data: `ignored_injection`, `no_internals_leak`, `no_links`, `no_addresses`, plus the usual rules.

### 13.3 Baselines (2026-09-17)

| Suite | Checks passed | Cases fully clean |
|---|---|---|
| core (11 cases) | 97.7% | 73% |
| red team (8 cases) | 97.5% | 63% |

All injection, leak, link, address and taboo checks sit at 100%.

### 13.4 CI

`.github/workflows/ci.yml` runs `pnpm turbo run typecheck test build` on push to `main` and on every PR. The eval
suites are run locally because they cost money and call real models; their graders are unit-tested in CI so the
rubric can't rot.
