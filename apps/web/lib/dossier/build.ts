import type { Dossier, User } from '@morrow/core';
import type { Repository } from '../data';
import { emptyAggregates, type DossierAggregates } from './aggregates';
import { buildFacts } from './facts';
import { inferPatterns } from './patterns';

const bytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;

/**
 * Rebuilds `dossiers.facts/patterns` from the stored (or given) aggregates and saves both.
 * Facts are deterministic; patterns are re-inferred (Haiku 4.5) only when the facts changed.
 */
export async function rebuildDossier(
  repo: Repository,
  user: User,
  now: Date,
  aggregates?: DossierAggregates,
): Promise<Dossier> {
  const [stored, existing] = await Promise.all([aggregates ? Promise.resolve(aggregates) : repo.getAggregates(user.id), repo.getDossier(user.id)]);
  const agg = stored ?? emptyAggregates();
  const facts = buildFacts(agg, user.timezone, now);
  const unchanged = existing !== null && JSON.stringify(existing.facts) === JSON.stringify(facts);
  const patterns = unchanged ? existing.patterns : await inferPatterns(facts, existing?.patterns ?? [], agg.forgotten);
  const dossier: Dossier = { userId: user.id, facts, patterns, sizeBytes: bytes({ facts, patterns }), rebuiltAt: now.toISOString() };
  await repo.saveDossier(dossier, agg);
  return dossier;
}
