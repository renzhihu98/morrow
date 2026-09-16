import { authed, toCoreUser } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { now } from '@/lib/server/env';
import { getTodayView } from '@/lib/server/readings';

export const maxDuration = 120;

export const GET = authed(async (user) => Response.json(await getTodayView(getRepository(), toCoreUser(user), now())));
