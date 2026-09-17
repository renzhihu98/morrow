import type { Metadata } from 'next';
import { connection } from 'next/server';
import { DossierView } from '@/components/DossierView';
import { requirePageUser, toCoreUser } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { now } from '@/lib/server/env';

export const metadata: Metadata = { title: 'Your dossier' };

export default async function DossierPage() {
  await connection();
  const repo = getRepository();
  const user = toCoreUser(await requirePageUser());
  const dossier = (await repo.getDossier(user.id)) ?? {
    userId: user.id,
    sizeBytes: 0,
    rebuiltAt: now().toISOString(),
    facts: [],
    patterns: [],
  };
  return <DossierView initial={dossier} />;
}
