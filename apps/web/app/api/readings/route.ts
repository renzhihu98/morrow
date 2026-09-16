import { authed, toCoreUser } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { now } from '@/lib/server/env';
import { getReadingsView } from '@/lib/server/readings';

export const GET = authed(async (user) => Response.json(await getReadingsView(getRepository(), toCoreUser(user), now())));
