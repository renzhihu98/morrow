import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

// `vercel env pull apps/web/.env.local` → DATABASE_URL for db:migrate / db:studio.
if (!process.env.DATABASE_URL && existsSync('.env.local')) process.loadEnvFile('.env.local');

export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://localhost:5432/morrow' },
});
