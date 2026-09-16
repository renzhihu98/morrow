import { z } from 'zod';
import { CheckCondition } from './prophecy';
import { SourceKind } from './source';

/** Structured output of the dawn job (Sonnet 5). */
export const DailyReadingOutput = z.object({
  observation: z.object({
    text: z.string(),
    evidenceRef: z.string(),
    sourceLabel: z.string(),
  }),
  prophecy: z.object({
    statement: z.string(),
    checkCondition: CheckCondition,
    windowDays: z.number().int().min(1).max(60),
    likelihood: z.number().min(0).max(1),
    watching: z.array(SourceKind).min(1),
  }),
});
export type DailyReadingOutput = z.infer<typeof DailyReadingOutput>;
