import type { DossierResponse } from '@morrow/core';
import { authed } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { now } from '@/lib/server/env';

export const GET = authed(async (user) => {
  const dossier = (await getRepository().getDossier(user.id)) ?? {
    userId: user.id,
    sizeBytes: 0,
    rebuiltAt: now().toISOString(),
    facts: [],
    patterns: [],
  };
  return Response.json({ dossier } satisfies DossierResponse);
});
