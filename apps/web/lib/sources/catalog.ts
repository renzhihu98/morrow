import { fixtures, type Source, type SourceKind } from '@morrow/core';

type SourceCopy = Pick<Source, 'kind' | 'name' | 'provider' | 'reads'>;

/** Static display copy per source kind (from the canonical fixtures, which match the designs). */
export const SOURCE_CATALOG: Record<SourceKind, SourceCopy> = Object.fromEntries(
  fixtures.sources.map(({ kind, name, provider, reads }) => [kind, { kind, name, provider, reads }]),
) as Record<SourceKind, SourceCopy>;

export const SOURCE_ORDER: SourceKind[] = ['calendar', 'spotify', 'mail', 'instagram'];
