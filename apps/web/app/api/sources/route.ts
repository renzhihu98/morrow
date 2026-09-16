import { authed, toCoreUser } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { getSourcesView } from '@/lib/server/readings';

export const GET = authed(async (user) => Response.json(await getSourcesView(getRepository(), toCoreUser(user))));
