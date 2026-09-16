import { hasDatabase } from '../server/env';
import { createDrizzleRepository } from './drizzle';
import { memoryRepository } from './memory';
import type { Repository } from './repository';

export type { Repository, ReserveQuestionResult, SourceState, SourceStatePatch } from './repository';
export { ReadingExistsError } from './repository';

const g = globalThis as typeof globalThis & { __morrowDbRepo?: Repository };

/** Postgres when DATABASE_URL is set, otherwise the fixture-seeded in-memory repository. */
export function getRepository(): Repository {
  if (hasDatabase()) {
    g.__morrowDbRepo ??= createDrizzleRepository();
    return g.__morrowDbRepo;
  }
  return memoryRepository();
}
