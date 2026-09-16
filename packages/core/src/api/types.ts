import { z } from 'zod';
import { IsoDateTime } from '../schemas/common';
import { Dossier } from '../schemas/dossier';
import { Message } from '../schemas/message';
import { Prophecy, ProphecyStatus } from '../schemas/prophecy';
import { Reading } from '../schemas/reading';
import { Source, SourceKind } from '../schemas/source';
import { User } from '../schemas/user';

/** GET /api/today */
export const TodayResponse = z.object({
  user: User,
  /** Server time the response was built (fixtures: FIXTURE_NOW). */
  now: IsoDateTime,
  reading: Reading,
  messages: z.array(Message),
  /** Every prophecy referenced by `messages` (made or fulfilled announcements). */
  prophecies: z.array(Prophecy),
  questionLimit: z.number().int().positive(),
  questionsLeft: z.number().int().nonnegative(),
});
export type TodayResponse = z.infer<typeof TodayResponse>;

/** GET /api/readings — newest first. `total` may exceed `readings.length` ("23 readings"). */
export const ReadingsResponse = z.object({
  readings: z.array(Reading),
  total: z.number().int().nonnegative(),
});
export type ReadingsResponse = z.infer<typeof ReadingsResponse>;

/** GET /api/readings/[date] */
export const ReadingDetailResponse = z.object({
  reading: Reading,
  messages: z.array(Message),
  prophecies: z.array(Prophecy),
});
export type ReadingDetailResponse = z.infer<typeof ReadingDetailResponse>;

/** GET /api/prophecies — `open` newest first, `resolved` newest first. */
export const ProphecyListResponse = z.object({
  open: z.array(Prophecy),
  resolved: z.array(Prophecy),
  record: z.object({
    fulfilled: z.number().int().nonnegative(),
    open: z.number().int().nonnegative(),
    expired: z.number().int().nonnegative(),
    /** Last 12 prophecies, oldest → newest: filled dot / dash / hollow. */
    marks: z.array(ProphecyStatus),
  }),
});
export type ProphecyListResponse = z.infer<typeof ProphecyListResponse>;

/** GET /api/sources */
export const SourcesResponse = z.object({
  sources: z.array(Source),
  dossier: z.object({
    sizeBytes: z.number().int().nonnegative(),
    rebuiltAt: IsoDateTime,
    factCount: z.number().int().nonnegative(),
  }),
});
export type SourcesResponse = z.infer<typeof SourcesResponse>;

/** GET /api/dossier */
export const DossierResponse = z.object({ dossier: Dossier });
export type DossierResponse = z.infer<typeof DossierResponse>;

/** POST /api/forget */
export const ForgetRequest = z.object({ confirm: z.literal('FORGET') });
export type ForgetRequest = z.infer<typeof ForgetRequest>;

/** Body of DELETE /api/dossier/facts/[id], POST /api/forget, source connect/disconnect. */
export const OkResponse = z.object({ ok: z.literal(true) });
export type OkResponse = z.infer<typeof OkResponse>;

/** POST /api/sources/[kind]/connect — OAuth stub; `authorizeUrl` null in demo mode. */
export const ConnectSourceResponse = z.object({
  kind: SourceKind,
  authorizeUrl: z.string().nullable(),
});
export type ConnectSourceResponse = z.infer<typeof ConnectSourceResponse>;

export const ApiErrorCode = z.enum([
  'reading_sealed',
  'question_limit',
  'bad_request',
  'unauthorized',
  'not_found',
  'server_error',
  'network_error',
  'unknown',
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCode>;

/** JSON body for non-2xx responses: `{ error: { code, message } }`. */
export const ApiErrorBody = z.object({
  error: z.object({ code: ApiErrorCode, message: z.string() }),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBody>;
