import { isReadingOpen, prophecyRecord, QUESTION_LIMIT, type Message, type MessagePart } from '@morrow/core';
import { createUIMessageStream, createUIMessageStreamResponse, generateId } from 'ai';
import { z } from 'zod';
import { writeModelAnswer, writeOfflineAnswer } from '@/lib/ai/chat';
import { writeDemoAnswer } from '@/lib/ai/demo';
import { scrubTaboo } from '@/lib/ai/taboo';
import type { MorrowUIMessage } from '@/lib/chat-types';
import { authed, toCoreUser } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';
import { hasModelAccess, isDemoData, now as serverNow } from '@/lib/server/env';
import { apiError } from '@/lib/server/http';
import { ensureTodayReading } from '@/lib/server/readings';

// Tool calls plus a drawn answer can run past a minute; the stream must not be cut mid-answer.
export const maxDuration = 300;

const ChatRequest = z.object({
  message: z.object({
    id: z.string().min(1).max(100),
    role: z.literal('user'),
    parts: z.array(z.object({ type: z.string(), text: z.string().optional() }).loose()).min(1),
  }),
  /** Optional: the reading the client is looking at. A stale one yields 409 so the client can go to today. */
  readingId: z.string().optional(),
});

/** Stored parts from the streamed UI message: observation (serif answer) + text (body). */
function toStoredParts(message: MorrowUIMessage): MessagePart[] {
  const parts: MessagePart[] = [];
  for (const p of message.parts) {
    if (p.type === 'data-observation') parts.push({ type: 'observation', ...p.data });
    if (p.type === 'text') {
      const text = scrubTaboo(p.text).text;
      if (text) parts.push({ type: 'text', text });
    }
  }
  return parts;
}

export const POST = authed(async (sessionUser, req: Request) => {
  const parsed = ChatRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError('bad_request', 'Expected { message: { id, role: "user", parts } }.');
  const question = parsed.data.message.parts
    .map((p) => (p.type === 'text' ? (p.text ?? '') : ''))
    .join('')
    .trim()
    .slice(0, 2000);
  if (!question) return apiError('bad_request', 'Ask Morrow something.');

  const repo = getRepository();
  const now = serverNow();
  const user = toCoreUser(sessionUser);

  if (parsed.data.readingId) {
    const requested = await repo.getReading(user.id, parsed.data.readingId);
    if (!requested || !isReadingOpen(requested, now)) {
      return apiError('reading_sealed', 'This reading is sealed. Morrow speaks once a day.');
    }
  }

  const reading = await ensureTodayReading(repo, user, now);
  if (!isReadingOpen(reading, now)) return apiError('reading_sealed', 'This reading is sealed. Morrow speaks once a day.');

  const history = await repo.listMessages(user.id, reading.id);
  const reserved = await repo.reserveQuestion(user.id, reading.id, QUESTION_LIMIT);
  if (!reserved.ok) {
    return reserved.reason === 'limit'
      ? apiError('question_limit', `Morrow answers ${QUESTION_LIMIT} questions a day. Come back after dawn.`)
      : apiError('reading_sealed', 'This reading is sealed. Morrow speaks once a day.');
  }

  const userMessage: Message = {
    id: parsed.data.message.id,
    readingId: reading.id,
    role: 'user',
    parts: [{ type: 'text', text: question }],
    createdAt: now.toISOString(),
  };
  await repo.appendMessage(user.id, userMessage);

  const assistantId = `m_${generateId()}`;
  const stream = createUIMessageStream<MorrowUIMessage>({
    execute: async ({ writer }) => {
      writer.write({ type: 'start', messageId: assistantId });
      writer.write({ type: 'data-quota', id: 'quota', data: { used: reserved.used, limit: QUESTION_LIMIT } });
      if (hasModelAccess()) {
        await writeModelAnswer(writer, { repo, user, reading, history, question, now, used: reserved.used, abortSignal: req.signal });
      } else if (!isDemoData()) {
        await writeOfflineAnswer(writer, { repo, user });
      } else {
        const record = prophecyRecord(await repo.listProphecies(user.id));
        await writeDemoAnswer(writer, { question, record, name: user.name }, req.signal);
      }
    },
    onError: (error) => {
      console.error('[morrow] chat stream error', error);
      return 'Morrow lost the thread. Try again in a moment.';
    },
    onEnd: async ({ responseMessage }) => {
      const parts = toStoredParts(responseMessage);
      if (parts.length === 0) return;
      await repo.appendMessage(user.id, {
        id: assistantId,
        readingId: reading.id,
        role: 'assistant',
        parts,
        createdAt: serverNow().toISOString(),
      });
    },
  });

  return createUIMessageStreamResponse({ stream });
});
