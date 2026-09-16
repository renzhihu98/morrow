/**
 * Dev only: `pnpm --filter @morrow/web sources:resync [--user <id> | --email <address>]`
 * Runs the normal sync (all linked sources) for one user and rebuilds the dossier in their current timezone.
 * Prints counts and fact labels only — never event titles or contact names.
 */
import { devContext } from './_dev';

const { repo, user } = await devContext('sources:resync');
const { syncUser } = await import('../lib/sources/sync');

const before = await Promise.all((['calendar', 'spotify'] as const).map((k) => repo.getSourceState(user.id, k)));
console.log(`timezone: ${user.timezone}`);
console.log('before:', before.map((s) => s && `${s.kind} ${s.eventCount}${s.calendarCount ? ` (${s.calendarCount} calendars)` : ''}`).filter(Boolean).join(' · '));

const results = await syncUser(repo, user, new Date());
for (const r of results) {
  if (!r.ok) console.log(`${r.kind}: FAILED (${r.state}) ${r.error}`);
  else console.log(`${r.kind}: fetched ${r.fetched}, stored raw ${r.stored}, count ${r.eventCount}${r.calendars ? ` · calendars ${JSON.stringify(r.calendars)}` : ''}`);
}
const dossier = await repo.getDossier(user.id);
console.log('\nfacts:');
for (const f of dossier?.facts ?? []) console.log(`- ${f.id.startsWith('people.') ? 'people.<contact>' : f.id} · ${f.category} · [${f.sources.join(', ')}]`);
console.log('patterns:', dossier?.patterns.length ?? 0);
