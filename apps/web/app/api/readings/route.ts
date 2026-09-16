import { getRepository } from '@/lib/data';
import { now } from '@/lib/server/env';
import { handle } from '@/lib/server/http';
import { getReadingsView } from '@/lib/server/readings';

export const GET = handle(async () => Response.json(await getReadingsView(getRepository(), now())));
