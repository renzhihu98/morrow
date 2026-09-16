/**
 * SPEC §10 chat protocol — shared UI message typing, part helpers and the
 * scripted demo stream used when the API is unreachable. Pure (no RN imports).
 */
import { fixtures, QUESTION_LIMIT, type SourceKind } from '@morrow/core';
import type { UIMessage, UIMessageChunk } from 'ai';

export type StepData = {
  id: string;
  source: SourceKind | 'memory';
  label: string;
  detail: string;
  status: 'done' | 'active' | 'pending';
};
export type ObservationData = { text: string; evidenceRef: string; sourceLabel: string };
export type QuotaData = { used: number; limit: number };

export type MorrowDataTypes = {
  step: StepData;
  observation: ObservationData;
  quota: QuotaData;
};

export type MorrowUIMessage = UIMessage<never, MorrowDataTypes>;
export type MorrowChunk = UIMessageChunk<never, MorrowDataTypes>;

/** Request body per §10: only the newest message is sent; the server owns history. */
export function lastMessageBody(messages: MorrowUIMessage[]): { message: MorrowUIMessage } | { message: null } {
  const last = messages[messages.length - 1];
  return { message: last ?? null };
}

export type AssistantView = {
  steps: StepData[];
  texts: string[];
  observation: ObservationData | null;
  quota: QuotaData | null;
};

/** Collapse an assistant UI message into what the screen renders (steps deduped by id, last write wins). */
export function assistantView(message: MorrowUIMessage): AssistantView {
  const steps = new Map<string, StepData>();
  const texts: string[] = [];
  let observation: ObservationData | null = null;
  let quota: QuotaData | null = null;
  for (const part of message.parts) {
    switch (part.type) {
      case 'data-step':
        steps.set(part.data.id ?? part.id ?? String(steps.size), part.data);
        break;
      case 'data-observation':
        observation = part.data;
        break;
      case 'data-quota':
        quota = part.data;
        break;
      case 'text':
        if (part.text.trim()) texts.push(part.text);
        break;
      default:
        break;
    }
  }
  return { steps: [...steps.values()], texts, observation, quota };
}

export const userText = (message: MorrowUIMessage) =>
  message.parts
    .map((p) => (p.type === 'text' ? p.text : ''))
    .join('')
    .trim();

/** Latest `data-quota` across messages, if any. */
export function latestQuota(messages: MorrowUIMessage[]): QuotaData | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && m.role === 'assistant') {
      const q = assistantView(m).quota;
      if (q) return q;
    }
  }
  return null;
}

// ─── Demo script (§10 "Demo mode") ──────────────────────────────────────────

const answerMessage = fixtures.messages['r_2026-09-16']?.find((m) => m.id === 'm_2026-09-16_4');
const answerTexts = (answerMessage?.parts ?? []).flatMap((p) => (p.type === 'text' ? [p.text] : []));

export const DEMO_ANSWER = {
  texts: answerTexts,
  sourceLabel: 'Calendar · Spotify · 11 Thursdays kept',
};

export type ScriptedChunk = { delayMs: number; chunk: MorrowChunk };

/**
 * Scripted Morrow reply: quota → steps (Calendar done → Spotify active → Past readings pending)
 * → steps resolve → streamed answer text. Mirrors the server's demo mode.
 */
export function demoScript(used: number, limit: number = QUESTION_LIMIT): ScriptedChunk[] {
  const messageId = `m_demo_${Date.now().toString(36)}`;
  const step = (id: string, source: StepData['source'], label: string, detail: string, status: StepData['status']): MorrowChunk => ({
    type: 'data-step',
    id,
    data: { id, source, label, detail, status },
  });

  const out: ScriptedChunk[] = [
    { delayMs: 0, chunk: { type: 'start', messageId } },
    { delayMs: 0, chunk: { type: 'data-quota', data: { used, limit } } },
    { delayMs: 250, chunk: step('s_calendar', 'calendar', 'Calendar', '4 moved coffees, all on Mondays', 'active') },
    { delayMs: 50, chunk: step('s_spotify', 'spotify', 'Spotify', 'What you played the nights before…', 'pending') },
    { delayMs: 50, chunk: step('s_memory', 'memory', 'Past readings', 'The reading from 09.16', 'pending') },
    { delayMs: 900, chunk: step('s_calendar', 'calendar', 'Calendar', '4 moved coffees, all on Mondays', 'done') },
    { delayMs: 0, chunk: step('s_spotify', 'spotify', 'Spotify', 'What you played the nights before…', 'active') },
    { delayMs: 1400, chunk: step('s_spotify', 'spotify', 'Spotify', 'What you played the nights before…', 'done') },
    { delayMs: 0, chunk: step('s_memory', 'memory', 'Past readings', 'The reading from 09.16', 'active') },
    { delayMs: 900, chunk: step('s_memory', 'memory', 'Past readings', 'The reading from 09.16', 'done') },
  ];

  DEMO_ANSWER.texts.forEach((text, i) => {
    const id = `t_${i}`;
    out.push({ delayMs: i === 0 ? 200 : 120, chunk: { type: 'text-start', id } });
    const words = text.split(/(?<= )/);
    for (const w of words) out.push({ delayMs: 35, chunk: { type: 'text-delta', id, delta: w } });
    out.push({ delayMs: 0, chunk: { type: 'text-end', id } });
  });

  out.push({
    delayMs: 100,
    chunk: {
      type: 'data-observation',
      data: { text: DEMO_ANSWER.texts[0] ?? '', evidenceRef: 'dossier.rhythms.protected_time', sourceLabel: DEMO_ANSWER.sourceLabel },
    },
  });
  out.push({ delayMs: 0, chunk: { type: 'finish' } });
  return out;
}
