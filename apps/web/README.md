# @morrow/web

Next.js 16 (App Router) web app for Morrow: every screen from the Paper v2 designs, all API routes (SPEC §7, §10) and the cron jobs. Mobile (`apps/mobile`) is a client of this API.

## Run

```sh
pnpm install                      # from the repo root
pnpm --filter @morrow/web dev     # http://localhost:3000
pnpm --filter @morrow/web typecheck   # next typegen + tsc
pnpm --filter @morrow/web test        # vitest (extractors, verification, taboo filter, views)
pnpm --filter @morrow/web build
```

## Environment

Copy the root `.env.example` to `apps/web/.env.local`. Everything is optional.

| Variable | Effect when set | When unset |
| --- | --- | --- |
| `DATABASE_URL` | Postgres (Neon) via Drizzle — `drizzleRepository` | In-memory repository seeded from `@morrow/core` fixtures; clock starts at `FIXTURE_NOW` (09.30 09:12, Los Angeles) |
| `AI_GATEWAY_API_KEY` / `VERCEL_OIDC_TOKEN` | Real readings, summaries and chat through Vercel AI Gateway | Deterministic dossier-grounded readings + scripted chat stream |
| `CRON_SECRET` | `/api/cron/*` require `Authorization: Bearer <secret>` | Cron routes are open outside production, `401` in production |
| `GOOGLE_CLIENT_ID/SECRET`, `SPOTIFY_CLIENT_ID/SECRET` | Connect returns a provider authorize URL | Connect marks the source linked immediately (demo) |
| `MORROW_DEMO_USER_ID/NAME/TIMEZONE` | Demo user provisioned in Postgres | Iris, `America/Los_Angeles` |
| `TOKEN_ENCRYPTION_KEY` | Reserved for encrypting OAuth tokens (TODO) | — |

### Demo mode

With no database and no model key the whole app runs on the canonical fixture story: today is 09.30 and opens on the "Sam wrote first." fulfilled prophecy (screen 03). Asking a question streams a scripted answer with the same UI message parts as the model path (steps → observation → text) with realistic delays; a few scripts are chosen by keyword ("write back", "track record", "what comes next"), everything else gets the canonical Sam answer. State lives in memory and resets when the server restarts.

### Database

```sh
DATABASE_URL=… pnpm --filter @morrow/web db:migrate    # apply drizzle/0000_init.sql
pnpm --filter @morrow/web db:generate                   # after editing lib/db/schema.ts
```

The scaffold has a single demo user; on first request it's provisioned with unlinked sources and the fixture dossier.

## Chat protocol

`POST /api/chat` with `{ message: { id, role: "user", parts: [{ type: "text", text }] }, readingId? }` → AI SDK UI message stream with `data-quota` (first), `data-step` (re-emitted by id as status changes), `data-observation` and `text` parts. `409 reading_sealed` if the day is sealed (or `readingId` is stale), `429 question_limit` after 15 questions. The server owns history and persists the user message before streaming and the assistant message (`observation` + `text` parts) when the stream ends.

## Architecture

```
app/
  page.tsx                    Today — server-renders the GET /api/today payload into <Today/>
  readings/, readings/[date]  archive · sealed transcript (open reading redirects to /)
  prophecies/, sources/, sources/dossier/, sources/forget/
  api/…                       route handlers (SPEC §7); cron/dawn + cron/verify
components/                   TopBar/Nav, Orbit, Composer, Transcript (TurnLabel, EvidenceLine), ProphecyPanel/Card/WindowBar,
                              ReadingSteps, IndexList, RecordMarks, SourceRow, DossierView (DossierRow), ConfirmForget, ThemeToggle
lib/
  data/        Repository interface · memory.ts (fixtures) · drizzle.ts (Postgres) · index.ts picks by DATABASE_URL
  db/schema.ts Drizzle schema (SPEC §5.3; composite PKs with user_id for per-user ids like r_2026-09-30)
  server/      readings.ts (get-or-create today, seal + summarize, views) · env.ts (clock, modes) · http.ts (errors, cron auth)
  ai/          models.ts · prompts.ts (persona, taboo list) · taboo.ts (post-generation filter) · reading.ts (structured
               DailyReadingOutput, summaries) · chat.ts (streamText + tools → data parts) · demo.ts (scripted stream)
  sources/     SourceAdapter + calendar/spotify/mail stubs (OAuth URLs; token exchange & sync are TODO)
  dossier/     extract.ts — deterministic extractors (reschedule counts, contact cadence) → dossier facts
  jobs/        dawn.ts (hourly, per-timezone) · verify.ts (checkCondition vs raw events, 30 min)
drizzle/       generated SQL migration
vercel.ts      crons: dawn hourly, verify every 30 min
```

Models (verified against the AI Gateway model list): `anthropic/claude-sonnet-5` for readings and chat, `anthropic/claude-haiku-4.5` for summaries.

## Known gaps

- Auth is a single demo user; Better Auth is next (SPEC §8).
- OAuth token exchange, token encryption and source sync are stubs; there is no OAuth callback route yet.
- `listening_pattern` / `generic` prophecies can only expire — auto-fulfilment needs a Haiku classifier.
- Opening a new reading via "Draw today's reading" is revealed client-side (not persisted as a turn).
- "Correct something" on the dossier is not designed yet.
