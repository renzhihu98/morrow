import { useChat } from '@ai-sdk/react';
import { ApiError, isApiError, QUESTION_LIMIT } from '@morrow/core';
import { DefaultChatTransport, type ChatTransport, type UIMessageChunk } from 'ai';
import { fetch as expoFetch } from 'expo/fetch';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  demoScript,
  lastMessageBody,
  latestQuota,
  type MorrowChunk,
  type MorrowUIMessage,
  type ScriptedChunk,
} from '@/lib/chat-protocol';
import { api, isDemoMode, isUnreachable, setDemoMode } from './api';

type SendOptions = Parameters<ChatTransport<MorrowUIMessage>['sendMessages']>[0];

/**
 * `expo/fetch` (streaming-capable) + typed errors for §10 pre-stream failures:
 * 409 → reading_sealed, 429 → question_limit, connection failures → network_error.
 */
const chatFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  let res: Response;
  try {
    res = (await expoFetch(String(input), init as Parameters<typeof expoFetch>[1])) as unknown as Response;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw e;
    throw new ApiError(0, 'network_error', e instanceof Error ? e.message : String(e));
  }
  if (res.status === 409) throw new ApiError(409, 'reading_sealed');
  if (res.status === 429) throw new ApiError(429, 'question_limit');
  return res;
}) as typeof globalThis.fetch;

function scriptedStream(script: ScriptedChunk[], signal: AbortSignal | undefined): ReadableStream<MorrowChunk> {
  let cancelled = false;
  return new ReadableStream<MorrowChunk>({
    async start(controller) {
      const onAbort = () => {
        cancelled = true;
      };
      signal?.addEventListener('abort', onAbort);
      for (const { delayMs, chunk } of script) {
        if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
        if (cancelled || signal?.aborted) break;
        controller.enqueue(chunk);
      }
      signal?.removeEventListener('abort', onAbort);
      controller.close();
    },
    cancel() {
      cancelled = true;
    },
  });
}

/** HTTP transport to `/api/chat`, falling back to the scripted demo stream when the API is unreachable. */
class MorrowTransport implements ChatTransport<MorrowUIMessage> {
  private http: DefaultChatTransport<MorrowUIMessage>;

  constructor(
    readingId: string,
    private readonly nextUsed: () => number,
  ) {
    this.http = new DefaultChatTransport<MorrowUIMessage>({
      api: api.chatUrl,
      fetch: chatFetch,
      // Only the newest message; `readingId` lets the server reject a stale day with 409.
      prepareSendMessagesRequest: ({ messages }) => ({ body: { ...lastMessageBody(messages), readingId } }),
    });
  }

  async sendMessages(options: SendOptions): Promise<ReadableStream<UIMessageChunk>> {
    if (!isDemoMode()) {
      try {
        return await this.http.sendMessages(options);
      } catch (e) {
        if (!isUnreachable(e)) throw e;
        setDemoMode(true);
      }
    }
    return scriptedStream(demoScript(this.nextUsed()), options.abortSignal ?? undefined) as ReadableStream<UIMessageChunk>;
  }

  async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return null;
  }
}

export type ChatBlock = 'none' | 'sealed' | 'limit';

// Questions used per reading during this session (so the menu sheet stays live while chatting).
const usage = new Map<string, number>();
const usageListeners = new Set<() => void>();
function reportUsage(readingId: string, used: number) {
  if (usage.get(readingId) === used) return;
  usage.set(readingId, used);
  for (const l of usageListeners) l();
}
const subscribeUsage = (l: () => void) => {
  usageListeners.add(l);
  return () => {
    usageListeners.delete(l);
  };
};

/** Live question count for a reading: max of the server's count and this session's chat. */
export function useQuestionsUsed(readingId: string | undefined, serverCount: number): number {
  const live = useSyncExternalStore(subscribeUsage, () => (readingId ? usage.get(readingId) : undefined));
  return Math.max(serverCount, live ?? 0);
}

/**
 * Today's conversation (one thread per reading). `baseUsed` is the reading's questionCount
 * from `/api/today`; `data-quota` parts override it as the stream reports.
 */
export function useMorrowChat({ readingId, baseUsed }: { readingId: string; baseUsed: number }) {
  const [block, setBlock] = useState<ChatBlock>('none');
  const sentAt = useRef(new Map<string, Date>());
  const usedRef = useRef(baseUsed);

  const transport = useMemo(() => new MorrowTransport(readingId, () => usedRef.current + 1), [readingId]);

  const chat = useChat<MorrowUIMessage>({
    id: readingId,
    transport,
    onError: (e) => {
      if (isApiError(e) && e.code === 'reading_sealed') setBlock('sealed');
      else if (isApiError(e) && e.code === 'question_limit') setBlock('limit');
    },
  });

  const quota = latestQuota(chat.messages);
  const sentCount = chat.messages.filter((m) => m.role === 'user').length;
  const used = quota ? Math.max(quota.used, baseUsed) : baseUsed + sentCount;
  const limit = quota?.limit ?? QUESTION_LIMIT;
  usedRef.current = used;
  useEffect(() => reportUsage(readingId, Math.min(used, limit)), [readingId, used, limit]);

  // Stamp local times for turn labels (UI messages carry no timestamps).
  for (const m of chat.messages) if (!sentAt.current.has(m.id)) sentAt.current.set(m.id, new Date());

  const { sendMessage } = chat;
  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return false;
      if (used >= limit) {
        setBlock('limit');
        return false;
      }
      void sendMessage({ text: trimmed });
      return true;
    },
    [sendMessage, used, limit],
  );

  const isBusy = chat.status === 'submitted' || chat.status === 'streaming';
  const errorMessage =
    chat.error && !(isApiError(chat.error) && (chat.error.code === 'reading_sealed' || chat.error.code === 'question_limit'))
      ? 'Morrow lost the thread. Try again.'
      : null;

  return {
    messages: chat.messages,
    status: chat.status,
    isBusy,
    stop: chat.stop,
    send,
    used: Math.min(used, limit),
    limit,
    block: block !== 'none' ? block : used >= limit ? ('limit' as const) : ('none' as const),
    errorMessage,
    timeOf: (id: string) => sentAt.current.get(id) ?? new Date(),
    reset: () => {
      chat.setMessages([]);
      chat.clearError();
      setBlock('none');
    },
  };
}
