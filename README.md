# Morrow

An AI fortune teller that "hot reads" your connected accounts. Observations are grounded in real data; prophecies are time-boxed and verified automatically against your sources. One reading a day, sealed at 04:00 local.

**Full product & engineering spec: [SPEC.md](./SPEC.md)** (source of truth, including the shared package contracts in §6).

## Structure

```
apps/
  web/        Next.js 16 — web UI, API routes, cron jobs
  mobile/     Expo + Expo Router — iOS/Android client of the web API
packages/
  tokens/     @morrow/tokens — design tokens (TS) + generated tokens.css
  core/       @morrow/core — zod schemas, domain rules, API client, demo fixtures
```

Packages ship TypeScript source (no build step); Next.js consumes them via `transpilePackages`, Metro directly.

## Getting started

Requires Node 22 (`nvm use`) and pnpm 9.

```sh
pnpm install
pnpm dev          # all apps via Turborepo
pnpm typecheck
pnpm test
```

Regenerate CSS variables after editing tokens: `pnpm --filter @morrow/tokens build:css`.

## Demo mode

With no `AI_GATEWAY_API_KEY` and no `DATABASE_URL`, the web app runs entirely on the fixtures in `@morrow/core` (user Iris, 2026-09-30 09:12 America/Los_Angeles) with scripted Morrow responses. Copy `.env.example` to `apps/web/.env.local` to use real services.
