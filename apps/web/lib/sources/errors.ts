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

const RATE_LIMIT_REASONS = /rateLimitExceeded|userRateLimitExceeded|quotaExceeded|RESOURCE_EXHAUSTED/;
const MAX_ATTEMPTS = 5;
/** Rate limits recover in seconds; two patient waits beat five quick ones that spend quota on failures. */
const RATE_LIMIT_ATTEMPTS = 2;

/**
 * GET JSON with bearer auth, mapping provider errors onto SourceAuthError / SourceSyncError. 429, 5xx and Google's
 * rate-limit 403s ("Quota exceeded … per minute") are retried with backoff — a 403 is only an auth failure when it
 * isn't a rate limit.
 */
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
    const text = res.status === 403 || res.status === 429 ? await res.text().catch(() => '') : '';
    const rateLimited = res.status === 429 || (res.status === 403 && RATE_LIMIT_REASONS.test(text));
    if (res.status === 401 || (res.status === 403 && !rateLimited)) {
      throw new SourceAuthError(`${new URL(url).host} rejected the grant (${res.status})`, res.status);
    }
    // A refused request still costs quota, so retrying a rate limit quickly digs the hole deeper: wait it out.
    if ((rateLimited || res.status >= 500) && attempt < (rateLimited ? RATE_LIMIT_ATTEMPTS : MAX_ATTEMPTS) - 1) {
      if (rateLimited) console.warn(`[morrow] ${new URL(url).host} rate limited, waiting ${attempt + 1}`);
      const retryAfter = Number(res.headers.get('retry-after'));
      const backoff = rateLimited ? 8000 * 2 ** attempt : 1000;
      await new Promise((r) => setTimeout(r, Math.min(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoff, 20_000)));
      continue;
    }
    throw new SourceSyncError(`${new URL(url).host} responded ${res.status}${rateLimited ? ' (rate limited)' : ''}`, res.status);
  }
}
