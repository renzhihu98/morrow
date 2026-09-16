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

Minimal sci-fi. Near-black space (dark) / cool lab grey (light), one aurora-green accent, coral reserved for destructive actions only. Off-centre layouts on desktop; a line-drawn **orbit diagram** represents Morrow.

### 4.1 Color tokens

| Token | Dark | Light | Use |
|---|---|---|---|
| `bg` | `#0C0D10` | `#F3F4F6` | page background |
| `panel` | `#15171B` | `#FFFFFF` | composer, cards, panels |
| `subtle` | `#25282E` | `#E6E8EC` | toggles, track fills, stop button |
| `hairline` | `#25282E` | `#DDE0E5` | dividers, borders |
| `hairlineStrong` | `#30333A` | `#C9CDD4` | glyph boxes, dashed borders, secondary buttons |
| `orbitFaint` | `#1E2126` | `#E1E3E7` | outer orbit ring |
| `orbitLine` | `#30333A` | `#C9CDD4` | orbit ellipses |
| `tick` | `#3A3D44` | `#BFC3CA` | orbit ticks, core outline |
| `textFaint` | `#4A4E56` | `#B5B9C0` | pending/disabled text, empty status "—" |
| `textMuted` | `#6C707A` | `#6E737D` | mono labels, meta |
| `placeholder` | `#6C707A` | `#8A8F98` | input placeholder |
| `textSecondary` | `#A9ADB6` | `#4E535B` | body copy, explanations |
| `textPrimary` | `#E4E5E9` | `#16181C` | headings, primary text |
| `accent` | `#A8E6CF` | `#2F8A6C` | Morrow's voice labels, dots, fulfilled, progress |
| `accentFill` | `#A8E6CF` | `#BFE8D8` | send / primary buttons |
| `onAccent` | `#0C0D10` | `#16181C` | text/icon on `accentFill` |
| `danger` | `#E8958A` | `#B8574A` | Forget everything only |
| `onDanger` | `#0C0D10` | `#FFFFFF` | text on `danger` |

Transparent variants used in designs: accent border `rgba(168,230,207,0.4)` dark / `rgba(47,138,108,0.45)` light; danger border at 50% alpha.

### 4.2 Typography

Three families, each with one job. **No italics anywhere.**

| Role | Family | Weight | Notes |
|---|---|---|---|
| Morrow's voice, titles, list items | **Instrument Serif** | 400 | letter-spacing −0.01 to −0.015em on large sizes |
| UI, body, user messages | **Geist** | 400 / 500 | |
| Data: timestamps, labels, counts, sources | **Geist Mono** | 400 | labels UPPERCASE, letter-spacing 0.04em |

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
| `label` (mono) | 11–12 / 14–16 | 10–11 / 12–14 |

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
- **Composer** — states `idle` (placeholder), `typing` (accent border + caret, send enabled), `waiting` ("Morrow is reading…", stop button), `sealed` (dashed border, lock icon, "Today's reading →" button). Shows `n OF 15 TODAY` (desktop) / `n/15` (mobile).
- **Turn labels** — mono `YOU — 06:51` (muted) and `● MORROW — 06:52` (accent).
- **Evidence line** — mono `SOURCE Calendar · 03.04 · 04.22 …`.
- **Prophecy panel/card** — number + window, serif statement, window bar (start → end with elapsed fill), `LIKELIHOOD 0.71`.
- **Reading steps** — left-bordered list: `✓ done`, `◌ active` (accent), `· pending` (faint).
- **Index list** — mono number column (`01`) + label with hairline dividers.
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
export type ThemeName = 'dark' | 'light';
export type Palette = { bg; panel; subtle; hairline; hairlineStrong; orbitFaint; orbitLine; tick;
  textFaint; textMuted; placeholder; textSecondary; textPrimary; accent; accentFill; onAccent;
  danger; onDanger: string };
export const colors: Record<ThemeName, Palette>;
export const alphaColors: Record<ThemeName, { accentBorder: string; dangerBorder: string }>;
export const fonts: { serif: 'Instrument Serif'; sans: 'Geist'; mono: 'Geist Mono' };
export type TypeToken = 'display' | 'title' | 'confirm' | 'answer' | 'prophecy' | 'listItem' | 'row' | 'bodyLg' | 'body' | 'label';
export type TypeStyle = { size: number; lineHeight: number; letterSpacing?: number };
export const typeScale: { desktop: Record<TypeToken, TypeStyle>; mobile: Record<TypeToken, TypeStyle> };
export const radii: { panel: 16; card: 14; button: 10; glyph: 10; dot: 999 };
export const space: { gutterDesktop: 120; gutterMobile: 24; composerInsetMobile: 16 };
```
- `size`/`lineHeight` are px (upper value where §4.2 gives a range). **`letterSpacing` is in em** — multiply by `size` for React Native px.
- Package points `main`/`types`/`exports` at `src/index.ts` (no build step).

Also ships `@morrow/tokens/tokens.css` (generated by `pnpm --filter @morrow/tokens build:css`, committed): `--color-<token>` in kebab-case (e.g. `--color-text-primary`, plus `--color-accent-border`, `--color-danger-border`), `--font-serif|sans|mono`, `--radius-panel|card|button|glyph|dot`. Light values on `:root`; dark values under `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` — i.e. follows the OS — and `[data-theme="dark" | "light"]` on `<html>` forces a theme.

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
  - `DossierCategory` = `rhythms | people | places | tastes`; `DossierFact { id, category, label (natural case; UI uppercases mono labels), value, sources }`; `DossierPattern { id, statement, confidence, sources }`; `Dossier { userId, sizeBytes, rebuiltAt, facts, patterns }`
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

1. ✅ Design (Paper, v2 dark/light, desktop/mobile)
2. ⏳ Scaffold: monorepo, tokens, core, web + mobile screens on fixtures, API contracts, demo mode
3. Provision Neon + AI Gateway on Vercel; replace demo user with Better Auth
4. Google Calendar + Spotify OAuth and extractors → real dossier
5. Dawn + verify cron jobs, evals (grounding, taboo, voice)
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

## 10. Chat protocol (web ⇄ mobile contract)

`POST /api/chat` — one thread per day, so the server owns history; clients send only the new message.

```jsonc
// request
{ "message": { "id": "m_…", "role": "user", "parts": [{ "type": "text", "text": "Should I say yes to Sam this time?" }] } }
```

- Response: **AI SDK UI message stream** (`result.toUIMessageStreamResponse()`), assistant message streamed as `text` parts plus custom data parts:
  - `data-step` `{ id, source: SourceKind | 'memory', label, detail, status: 'done' | 'active' | 'pending' }` — drives the "Morrow is reading" list (screen 06). Re-emitted with the same `id` to update status.
  - `data-observation` `{ text, evidenceRef, sourceLabel }` — serif answer + SOURCE line (screen 07).
  - `data-quota` `{ used, limit }` — sent at stream start; drives `n OF 15 TODAY`.
- Errors before streaming: `409 { error: { code: "reading_sealed" } }`, `429 { error: { code: "question_limit" } }`.
- Clients: web uses `useChat` from `@ai-sdk/react` with `DefaultChatTransport({ api: '/api/chat', prepareSendMessagesRequest })` sending only the last message; mobile uses the same with `fetch` from `expo/fetch` and an absolute `EXPO_PUBLIC_API_URL`.
- **Demo mode** (no `AI_GATEWAY_API_KEY`/OIDC): server streams a scripted response with the same parts (steps: Calendar done → Spotify active → Past readings pending, then the fixture answer) with small delays, so both clients look identical with or without a model.

## 11. Paper artboard IDs (file `01M2NRFN984ZCAHJT65TCM7QXR`)

| Screen | Desktop dark | Desktop light | Mobile dark | Mobile light |
|---|---|---|---|---|
| 01 Invocation | `7L-0` | `DC-0` | `I2-0` | `NT-0` |
| 02 Reading | `9B-0` | `ES-0` | `JQ-0` | `PA-0` |
| 03 Fulfilled | `BL-0` | `GC-0` | `L7-0` | `QP-0` |
| 04 Past readings | `SG-0` | `YD-0` | `148-0` | `18R-0` |
| 05 Sealed reading | `U0-0` | `ZX-0` | `15N-0` | `1A6-0` |
| 06 Asking | `1D9-0` | `1I2-0` | `1L2-0` | `1PG-0` |
| 07 Answer | `1ET-0` | `1JQ-0` | `1MH-0` | `1QY-0` |
| 08 Menu | — | — | `1SM-0` | `1U3-0` |
| 09 Prophecies | `1XK-0` | `26G-0` | `2BE-0` | `2H5-0` |
| 10 Sources | `201-0` | `294-0` | `2D1-0` | `2IR-0` |
| 11 Dossier | `2KT-0` | `2SI-0` | `2W3-0` | `32G-0` |
| 12 Forget | `2N3-0` | `2UN-0` | `2Y5-0` | `343-0` |
