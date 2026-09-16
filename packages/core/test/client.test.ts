import { describe, expect, it } from 'vitest';
import { ApiError, createApiClient, fixtures } from '../src';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('createApiClient', () => {
  it('uses the injected fetch and base url', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const api = createApiClient({
      baseUrl: 'https://example.test/',
      fetch: async (url, init) => {
        calls.push({ url, init });
        return json(200, fixtures.api.today);
      },
    });
    const today = await api.getToday();
    expect(today.user.name).toBe('Iris');
    expect(calls[0]!.url).toBe('https://example.test/api/today');
  });

  it('sends the FORGET confirmation', async () => {
    let body: unknown;
    const api = createApiClient({
      baseUrl: '',
      fetch: async (_url, init) => {
        body = JSON.parse(String(init?.body));
        return json(200, { ok: true });
      },
    });
    await api.forgetEverything();
    expect(body).toEqual({ confirm: 'FORGET' });
  });

  it.each([
    [409, 'reading_sealed'],
    [429, 'question_limit'],
    [404, 'not_found'],
    [500, 'server_error'],
  ])('maps %i → %s', async (status, code) => {
    const api = createApiClient({ baseUrl: '', fetch: async () => json(status, { error: { code: 'unknown', message: 'x' } }) });
    const err = await api.getReadings().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(status);
    expect(err.code).toBe(code);
  });
});
