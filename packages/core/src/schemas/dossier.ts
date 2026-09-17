import { z } from 'zod';
import { IsoDateTime } from './common';
import { SourceKind } from './source';

export const DossierCategory = z.enum(['rhythms', 'pursuits', 'people', 'places', 'tastes']);
export type DossierCategory = z.infer<typeof DossierCategory>;

export const DossierFact = z.object({
  id: z.string(),
  category: DossierCategory,
  /** Uppercase-able label, e.g. "First light". */
  label: z.string(),
  value: z.string(),
  sources: z.array(SourceKind),
});
export type DossierFact = z.infer<typeof DossierFact>;

export const DossierPattern = z.object({
  id: z.string(),
  statement: z.string(),
  confidence: z.number().min(0).max(1),
  sources: z.array(SourceKind),
});
export type DossierPattern = z.infer<typeof DossierPattern>;

export const Dossier = z.object({
  userId: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  rebuiltAt: IsoDateTime,
  facts: z.array(DossierFact),
  patterns: z.array(DossierPattern),
});
export type Dossier = z.infer<typeof Dossier>;
