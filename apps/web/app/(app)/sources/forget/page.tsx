import type { Metadata } from 'next';
import { connection } from 'next/server';
import { ConfirmForget } from '@/components/ConfirmForget';
import { requirePageUser, toCoreUser } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { formatKb } from '@/lib/ui/format';

export const metadata: Metadata = { title: 'Forget everything' };

/** 14 Forget everything (Paper v4 BE4-0 / B4T-0). */
export default async function ForgetPage() {
  await connection();
  const repo = getRepository();
  const user = toCoreUser(await requirePageUser());
  const [{ total }, prophecies, dossier, sources] = await Promise.all([
    repo.listReadings(user.id, 1),
    repo.listProphecies(user.id),
    repo.getDossier(user.id),
    repo.listSources(user.id),
  ]);

  return (
    <main className="mx-auto w-full max-w-[1088px] px-6 pb-20 pt-8 lg:box-content lg:px-12 lg:pt-[144px]">
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
