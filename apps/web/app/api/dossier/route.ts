import type { DossierResponse } from '@morrow/core';
import { getRepository } from '@/lib/data';
import { now } from '@/lib/server/env';
import { handle } from '@/lib/server/http';

export const GET = handle(async () => {
  const repo = getRepository();
  const user = await repo.getDemoUser();
  const dossier = (await repo.getDossier(user.id)) ?? {
    userId: user.id,
    sizeBytes: 0,
    rebuiltAt: now().toISOString(),
    facts: [],
    patterns: [],
  };
  return Response.json({ dossier } satisfies DossierResponse);
});
