import type { Metadata } from 'next';
import { connection } from 'next/server';
import { ConfirmForget } from '@/components/ConfirmForget';
import { getRepository } from '@/lib/data';
import { formatKb } from '@/lib/ui/format';

export const metadata: Metadata = { title: 'Forget everything' };

export default async function ForgetPage() {
  await connection();
  const repo = getRepository();
  const user = await repo.getDemoUser();
  const [{ total }, prophecies, dossier, sources] = await Promise.all([
    repo.listReadings(user.id, 1),
    repo.listProphecies(user.id),
    repo.getDossier(user.id),
    repo.listSources(user.id),
  ]);

  return (
    <main className="mx-auto w-full max-w-[560px] px-6 pb-20 pt-8 lg:pt-10">
      <ConfirmForget
        counts={{
          readings: total,
          prophecies: prophecies.length,
          openProphecies: prophecies.filter((p) => p.status === 'open').length,
          dossierKb: formatKb(dossier?.sizeBytes ?? 0),
          connections: sources.filter((s) => s.status === 'linked').map((s) => s.name),
        }}
      />
    </main>
  );
}
