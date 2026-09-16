import type { SourceKind } from '@morrow/core';
import { calendarAdapter } from './calendar';
import { mailAdapter } from './mail';
import { spotifyAdapter } from './spotify';
import type { SourceAdapter } from './types';

export type { RawEvent, SourceAdapter } from './types';

/** Instagram is designed but not yet integrated (SPEC §5.1 "future"). */
export const SOURCE_ADAPTERS: Partial<Record<SourceKind, SourceAdapter>> = {
  calendar: calendarAdapter,
  spotify: spotifyAdapter,
  mail: mailAdapter,
};
