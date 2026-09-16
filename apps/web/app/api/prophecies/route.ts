import { getRepository } from '@/lib/data';
import { handle } from '@/lib/server/http';
import { getProphecyListView } from '@/lib/server/readings';

export const GET = handle(async () => Response.json(await getProphecyListView(getRepository())));
