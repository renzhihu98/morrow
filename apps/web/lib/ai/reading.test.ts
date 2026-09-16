import { fixtures, type DailyReadingOutput, type Dossier } from '@morrow/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateText = vi.hoisted(() => vi.fn());
vi.mock('ai', async (importOriginal) => ({ ...(await importOriginal<typeof import('ai')>()), generateText }));

const { generateDailyReading, resolveEvidence, templatedReading } = await import('./reading');

const dossier: Dossier = {
  userId: 'u_1',
  sizeBytes: 100,
  rebuiltAt: '2026-09-01T19:00:00.000Z',
  facts: [
    { id: 'people.sam_okafor', category: 'people', label: 'Sam', value: 'Moved 4 times, mostly Mondays (06.08 · 07.13)', sources: ['calendar'] },
    { id: 'rhythms.late_nights', category: 'rhythms', label: 'Late nights', value: 'Playing after 23:00 on 4 nights', sources: ['spotify'] },
  ],
  patterns: [],
};

const ctx = { user: { id: 'u_1', name: 'Iris', timezone: 'America/Los_Angeles' }, now: new Date('2026-09-02T05:00:00-07:00'), localDate: '2026-09-02', dossier, summaries: [], prophecies: [] };

const draft = (evidenceRef: string, text = 'Sam keeps sliding to Thursday.'): { output: DailyReadingOutput } => ({
  output: {
    observation: { text, evidenceRef, sourceLabel: 'Calendar · 06.08 · 07.13' },
    prophecy: {
      statement: 'Sam will suggest a Thursday.',
      checkCondition: { type: 'calendar_event_with', contact: 'sam_okafor', titleIncludes: null },
      windowDays: 10,
      likelihood: 0.6,
      watching: ['calendar'],
    },
  },
});

beforeEach(() => {
  generateText.mockReset();
  vi.stubEnv('AI_GATEWAY_API_KEY', 'test-key');
  vi.stubEnv('DATABASE_URL', 'postgres://example/test');
});

describe('resolveEvidence', () => {
  it('accepts ids with or without the dossier prefix and sub-paths, nothing else', () => {
    expect(resolveEvidence(dossier, 'people.sam_okafor')?.id).toBe('people.sam_okafor');
    expect(resolveEvidence(dossier, 'dossier.people.sam_okafor.moves')?.id).toBe('people.sam_okafor');
    expect(resolveEvidence(dossier, 'people.sam')).toBeNull();
    expect(resolveEvidence(null, 'people.sam_okafor')).toBeNull();
  });
});

describe('generateDailyReading grounding', () => {
  it('returns a grounded draft, normalising the evidence ref', async () => {
    generateText.mockResolvedValueOnce(draft('dossier.people.sam_okafor'));
    const out = await generateDailyReading(ctx);
    expect(out.observation.evidenceRef).toBe('people.sam_okafor');
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it('regenerates once with feedback when the evidence ref is not in the dossier', async () => {
    generateText.mockResolvedValueOnce(draft('people.sam')).mockResolvedValueOnce(draft('rhythms.late_nights', 'The music runs late.'));
    const out = await generateDailyReading(ctx);
    expect(generateText).toHaveBeenCalledTimes(2);
    expect(generateText.mock.calls[1]![0].prompt).toContain('not in the dossier');
    expect(out.observation).toMatchObject({ evidenceRef: 'rhythms.late_nights', text: 'The music runs late.' });
  });

  it('falls back to a templated observation from a real fact after two ungrounded or taboo drafts', async () => {
    generateText.mockResolvedValueOnce(draft('people.nobody')).mockResolvedValueOnce(draft('people.sam_okafor', 'You have been ill.'));
    const out = await generateDailyReading(ctx);
    expect(generateText).toHaveBeenCalledTimes(2);
    expect(out).toEqual(templatedReading(ctx));
    expect(out.observation.evidenceRef).toBe('people.sam_okafor');
    expect(out.prophecy.checkCondition).toEqual({ type: 'calendar_event_with', contact: 'sam_okafor', titleIncludes: null });
  });

  it('never calls the model for an empty dossier, and uses fixture templates in demo mode', async () => {
    const empty = await generateDailyReading({ ...ctx, dossier: { ...dossier, facts: [] } });
    expect(empty.observation.evidenceRef).toBe('dossier.empty');
    vi.stubEnv('AI_GATEWAY_API_KEY', '');
    vi.stubEnv('VERCEL_OIDC_TOKEN', '');
    vi.stubEnv('DATABASE_URL', '');
    const demo = await generateDailyReading({ ...ctx, dossier: fixtures.dossier });
    expect(resolveEvidence(fixtures.dossier, demo.observation.evidenceRef)).not.toBeNull();
    expect(generateText).not.toHaveBeenCalled();
  });
});
