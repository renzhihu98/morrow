/** Chat protocol types shared by the /api/chat route and the web client (SPEC §10). Client-safe. */
import type { SourceKind } from '@morrow/core';
import type { UIMessage } from 'ai';

export type StepData = {
  id: string;
  source: SourceKind | 'memory';
  label: string;
  detail: string;
  status: 'done' | 'active' | 'pending';
};

export type ObservationData = { text: string; evidenceRef: string; sourceLabel: string };

export type QuotaData = { used: number; limit: number };

export type MorrowDataParts = {
  step: StepData;
  observation: ObservationData;
  quota: QuotaData;
};

export type MorrowUIMessage = UIMessage<never, MorrowDataParts>;

/** Request body for POST /api/chat. `readingId` is optional; when stale the server answers 409. */
export type ChatRequestBody = {
  message: { id: string; role: 'user'; parts: { type: 'text'; text: string }[] };
  readingId?: string;
};
