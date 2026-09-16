/** The provider rejected the grant (401/403, revoked or missing refresh token) → source needs reauth. */
export class SourceAuthError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'SourceAuthError';
  }
}

/** Transient provider failure (rate limit, 5xx, network). */
export class SourceSyncError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'SourceSyncError';
  }
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** GET JSON with bearer auth, mapping provider errors onto SourceAuthError / SourceSyncError (one retry on 429/5xx). */
export async function getJson<T>(url: string, accessToken: string, fetchImpl: FetchLike = fetch): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetchImpl(url, { headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' } });
    } catch (e) {
      if (attempt === 0) continue;
      throw new SourceSyncError(`network error: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (res.ok) return (await res.json()) as T;
    if (res.status === 401 || res.status === 403) {
      throw new SourceAuthError(`${new URL(url).host} rejected the grant (${res.status})`, res.status);
    }
    if ((res.status === 429 || res.status >= 500) && attempt === 0) {
      const retryAfter = Number(res.headers.get('retry-after'));
      await new Promise((r) => setTimeout(r, Math.min(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000, 5000)));
      continue;
    }
    throw new SourceSyncError(`${new URL(url).host} responded ${res.status}`, res.status);
  }
}
