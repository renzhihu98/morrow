import { authed, toCoreUser } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { getProphecyListView } from '@/lib/server/readings';

export const GET = authed(async (user) => Response.json(await getProphecyListView(getRepository(), toCoreUser(user))));
