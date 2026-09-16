import { z } from 'zod';

/** Calendar date in the user's local reading day, `YYYY-MM-DD`. */
export const LocalDate = z.iso.date();
export type LocalDate = z.infer<typeof LocalDate>;

/** ISO 8601 instant with offset or `Z`, e.g. `2026-09-16T06:43:00-07:00`. */
export const IsoDateTime = z.iso.datetime({ offset: true });
export type IsoDateTime = z.infer<typeof IsoDateTime>;
