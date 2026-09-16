import { z } from 'zod';
import { IsoDateTime } from './common';
import { SourceKind } from './source';

export const TextPart = z.object({ type: z.literal('text'), text: z.string() });

export const ObservationPart = z.object({
  type: z.literal('observation'),
  text: z.string(),
  /** Path into the dossier backing this observation, e.g. `dossier.people.sam.reschedules`. */
  evidenceRef: z.string(),
  /** Human evidence line, e.g. `Calendar · 03.04 · 04.22 · 06.10 · 08.29`. */
  sourceLabel: z.string(),
});

export const ProphecyRefPart = z.object({
  type: z.literal('prophecyRef'),
  prophecyId: z.string(),
  /** `made`: prophecy issued in this message. `fulfilled`: announcement that it came true. */
  event: z.enum(['made', 'fulfilled']).default('made'),
});

export const ReadingStepStatus = z.enum(['done', 'active', 'pending']);
export type ReadingStepStatus = z.infer<typeof ReadingStepStatus>;

export const ReadingStep = z.object({
  label: z.string(),
  source: SourceKind.optional(),
  status: ReadingStepStatus,
});
export type ReadingStep = z.infer<typeof ReadingStep>;

export const StepsPart = z.object({ type: z.literal('steps'), items: z.array(ReadingStep) });

export const MessagePart = z.discriminatedUnion('type', [TextPart, ObservationPart, ProphecyRefPart, StepsPart]);
export type MessagePart = z.infer<typeof MessagePart>;

/** `assistant` is Morrow (label "● MORROW"). */
export const MessageRole = z.enum(['user', 'assistant']);
export type MessageRole = z.infer<typeof MessageRole>;

export const Message = z.object({
  id: z.string(),
  readingId: z.string(),
  role: MessageRole,
  parts: z.array(MessagePart),
  createdAt: IsoDateTime,
});
export type Message = z.infer<typeof Message>;
