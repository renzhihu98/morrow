import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

export type Db = ReturnType<typeof createDb>;

const createDb = (url: string) => drizzle({ client: neon(url), schema });

const g = globalThis as typeof globalThis & { __morrowDb?: Db };

/** Shared Drizzle client over Neon HTTP. Throws when DATABASE_URL is unset (callers check `hasDatabase()`). */
export function getDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  g.__morrowDb ??= createDb(url);
  return g.__morrowDb;
}
