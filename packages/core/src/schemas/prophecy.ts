import { z } from 'zod';
import { IsoDateTime, LocalDate } from './common';
import { SourceKind } from './source';

export const CheckCondition = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('email_from_contact'),
    /** Dossier person key, e.g. `sam`. */
    contact: z.string(),
    /** Inbound email must start a new thread (the contact "writes first"). */
    firstInThread: z.boolean(),
  }),
  z.object({
    type: z.literal('calendar_event_with'),
    contact: z.string(),
    titleIncludes: z.string().nullable(),
  }),
  z.object({
    type: z.literal('listening_pattern'),
    /** Natural-language pattern checked by the verifier, e.g. "new playlist created". */
    pattern: z.string(),
  }),
  z.object({
    type: z.literal('generic'),
    description: z.string(),
  }),
]);
export type CheckCondition = z.infer<typeof CheckCondition>;

export const ProphecyStatus = z.enum(['open', 'fulfilled', 'expired']);
export type ProphecyStatus = z.infer<typeof ProphecyStatus>;

export const Prophecy = z.object({
  /** Stable id, e.g. `p_0047`. */
  id: z.string(),
  /** Sequential number per user; display with `formatProphecyNumber` → "0047". */
  number: z.number().int().positive(),
  /** Full statement. */
  statement: z.string(),
  /** Short title for lists, e.g. "Sam will write first." */
  title: z.string(),
  checkCondition: CheckCondition,
  windowStart: IsoDateTime,
  windowEnd: IsoDateTime,
  likelihood: z.number().min(0).max(1),
  watching: z.array(SourceKind),
  status: ProphecyStatus,
  /** Local date the prophecy was made. */
  madeOn: LocalDate,
  madeInReadingId: z.string(),
  fulfilledInReadingId: z.string().nullable(),
  resolvedAt: IsoDateTime.nullable(),
});
export type Prophecy = z.infer<typeof Prophecy>;
