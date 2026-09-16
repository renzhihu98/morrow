import type { SourceKind } from '../schemas/source';
import { ApiErrorCode } from './types';
import type {
  ConnectSourceResponse,
  DossierResponse,
  ForgetRequest,
  OkResponse,
  ProphecyListResponse,
  ReadingDetailResponse,
  ReadingsResponse,
  SourcesResponse,
  TodayResponse,
} from './types';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  constructor(status: number, code: ApiErrorCode, message?: string) {
    super(message ?? `Morrow API error ${status} (${code})`);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

/** Status → code. 409 and 429 always win over the body. */
export function errorCodeForStatus(status: number): ApiErrorCode {
  if (status === 409) return 'reading_sealed';
  if (status === 429) return 'question_limit';
  if (status === 400 || status === 422) return 'bad_request';
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 404) return 'not_found';
  if (status >= 500) return 'server_error';
  return 'unknown';
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type ApiClientOptions = {
  /** e.g. `https://morrow.app` or `''` for same-origin on web. */
  baseUrl: string;
  /** Defaults to global fetch. */
  fetch?: FetchLike;
  /** Extra headers (e.g. auth) added to every request. */
  headers?: Record<string, string>;
};

export type ApiClient = ReturnType<typeof createApiClient>;

export function createApiClient({ baseUrl, fetch: fetchImpl, headers }: ApiClientOptions) {
  const root = baseUrl.replace(/\/+$/, '');

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const f: FetchLike = fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
    let res: Response;
    try {
      res = await f(`${root}${path}`, {
        method,
        headers: {
          accept: 'application/json',
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw new ApiError(0, 'network_error', e instanceof Error ? e.message : String(e));
    }

    if (!res.ok) {
      let code = errorCodeForStatus(res.status);
      let message: string | undefined;
      try {
        const data = (await res.json()) as { error?: { code?: string; message?: string } };
        message = data?.error?.message;
        const parsed = ApiErrorCode.safeParse(data?.error?.code);
        if (res.status !== 409 && res.status !== 429 && parsed.success && parsed.data !== 'unknown') {
          code = parsed.data;
        }
      } catch {
        /* non-JSON error body */
      }
      throw new ApiError(res.status, code, message);
    }

    if (res.status === 204) return { ok: true } as T;
    return (await res.json()) as T;
  }

  return {
    getToday: () => request<TodayResponse>('GET', '/api/today'),
    getReadings: () => request<ReadingsResponse>('GET', '/api/readings'),
    getReading: (date: string) => request<ReadingDetailResponse>('GET', `/api/readings/${encodeURIComponent(date)}`),
    getProphecies: () => request<ProphecyListResponse>('GET', '/api/prophecies'),
    getSources: () => request<SourcesResponse>('GET', '/api/sources'),
    getDossier: () => request<DossierResponse>('GET', '/api/dossier'),
    forgetFact: (id: string) => request<OkResponse>('DELETE', `/api/dossier/facts/${encodeURIComponent(id)}`),
    forgetEverything: () => request<OkResponse>('POST', '/api/forget', { confirm: 'FORGET' } satisfies ForgetRequest),
    connectSource: (kind: SourceKind) =>
      request<ConnectSourceResponse>('POST', `/api/sources/${encodeURIComponent(kind)}/connect`),
    disconnectSource: (kind: SourceKind) => request<OkResponse>('DELETE', `/api/sources/${encodeURIComponent(kind)}`),
    /** URL for the AI SDK UI message stream (`useChat` transport `api`). */
    chatUrl: `${root}/api/chat`,
  };
}
