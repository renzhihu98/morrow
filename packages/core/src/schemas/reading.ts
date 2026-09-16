import { z } from 'zod';
import { IsoDateTime, LocalDate } from './common';

export const ReadingStatus = z.enum(['open', 'sealed']);
export type ReadingStatus = z.infer<typeof ReadingStatus>;

export const Reading = z.object({
  id: z.string(),
  /** Local reading day (04:00 boundary), `YYYY-MM-DD`. Unique per user. */
  localDate: LocalDate,
  timezone: z.string(),
  status: ReadingStatus,
  /** First observation line — used as the title in lists. */
  headline: z.string(),
  /** Id of the prophecy made in this reading, if any. */
  prophecyId: z.string().nullable(),
  /** Memory summary, written at sealing. */
  summary: z.string().nullable(),
  /** User messages sent so far (max QUESTION_LIMIT). */
  questionCount: z.number().int().nonnegative(),
  openedAt: IsoDateTime,
  sealedAt: IsoDateTime.nullable(),
});
export type Reading = z.infer<typeof Reading>;

export const ReadingSummary = z.object({
  readingId: z.string(),
  localDate: LocalDate,
  summary: z.string(),
});
export type ReadingSummary = z.infer<typeof ReadingSummary>;
