/**
 * Dev only: `pnpm --filter @morrow/web sources:sync <kind> [--user <id> | --email <address>]`
 * Runs one source's sync (as after connecting) and rebuilds the dossier. Prints counts and fact ids only.
 */
import { SourceKind } from '@morrow/core';
import { devContext } from './_dev';

const kind = SourceKind.parse(process.argv[2]);
const { repo, user } = await devContext('sources:sync');
const { syncUser } = await import('../lib/sources/sync');
// A manual run retries a source stuck in needs_reauth/error (the grant itself may be fine).
const state = await repo.getSourceState(user.id, kind);
if (state && state.syncState !== 'ok') await repo.updateSourceState(user.id, kind, { syncState: 'pending', lastError: null });
const started = Date.now();
const results = await syncUser(repo, user, new Date(), { kinds: [kind] });
for (const r of results) console.log(r.ok ? `${r.kind}: fetched ${r.fetched}, count ${r.eventCount}${'threadsNoted' in r && r.threadsNoted !== undefined ? `, threads noted ${r.threadsNoted}` : ''}` : `${r.kind}: FAILED (${r.state}) ${r.error}`);
if (results.length === 0) console.log(`${kind} is not linked (or needs reauth).`);
console.log(`took ${Math.round((Date.now() - started) / 1000)}s`);
const dossier = await repo.getDossier(user.id);
for (const f of dossier?.facts ?? []) console.log(`- ${f.id.startsWith('people.') ? 'people.<contact>' : f.id} · [${f.sources.join(', ')}]`);
