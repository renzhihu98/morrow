import { fixtures, type DailyReadingOutput, type Dossier, type SourceKind } from '@morrow/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateText = vi.hoisted(() => vi.fn());
vi.mock('ai', async (importOriginal) => ({ ...(await importOriginal<typeof import('ai')>()), generateText }));

const { generateDailyReading, resolveEvidence, reviewDraft, templatedReading } = await import('./reading');

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
    const out = await generateDailyReading(ctx, { judge: null });
    expect(out.observation.evidenceRef).toBe('people.sam_okafor');
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it('regenerates once with feedback when the evidence ref is not in the dossier', async () => {
    generateText.mockResolvedValueOnce(draft('people.sam')).mockResolvedValueOnce(draft('rhythms.late_nights', 'The music runs late.'));
    const out = await generateDailyReading(ctx, { judge: null });
    expect(generateText).toHaveBeenCalledTimes(2);
    expect(generateText.mock.calls[1]![0].prompt).toContain('not in the dossier');
    expect(out.observation).toMatchObject({ evidenceRef: 'rhythms.late_nights', text: 'The music runs late.' });
  });

  it('falls back to a templated observation from a real fact after three ungrounded, taboo or low-quality drafts', async () => {
    const metric = draft('rhythms.late_nights', 'The music runs late.');
    metric.output.prophecy.statement = 'Your Monday start time will keep drifting later for another week before it settles back near 15:00.';
    generateText
      .mockResolvedValueOnce(draft('people.nobody'))
      .mockResolvedValueOnce(draft('people.sam_okafor', 'You have been ill.'))
      .mockResolvedValueOnce(metric);
    const out = await generateDailyReading(ctx, { judge: null });
    expect(generateText).toHaveBeenCalledTimes(3);
    expect(out).toEqual(templatedReading(ctx));
    expect(out.observation.evidenceRef).toBe('people.sam_okafor');
    expect(out.prophecy.checkCondition).toEqual({ type: 'calendar_event_with', contact: 'sam_okafor', titleIncludes: null });
  });

  it('regenerates with specific feedback when the prophecy restates a metric, then accepts a human one', async () => {
    const bad = draft('rhythms.late_nights', 'The music runs late.');
    bad.output.prophecy = {
      statement: 'Your Monday start time will keep drifting later for another week before it settles back near 15:00.',
      checkCondition: { type: 'listening_pattern', pattern: 'monday_start_later' },
      windowDays: 7,
      likelihood: 0.6,
      watching: ['calendar', 'spotify', 'mail'],
    };
    const good = draft('people.sam_okafor', 'Sam keeps moving on your calendar, and you keep letting it.');
    good.output.prophecy.statement = 'The dinner with Sam that keeps sliding will finally happen, and it will be easy.';
    good.output.prophecy.watching = ['calendar', 'mail'];
    generateText.mockResolvedValueOnce(bad).mockResolvedValueOnce(good);
    const out = await generateDailyReading({ ...ctx, sources: ['calendar', 'spotify'] }, { judge: null });
    expect(generateText).toHaveBeenCalledTimes(2);
    const feedback: string = generateText.mock.calls[1]![0].prompt;
    expect(feedback).toContain('contains digits');
    expect(feedback).toContain('metric language');
    expect(feedback).toContain('not a concrete, checkable listening pattern');
    expect(out.prophecy.statement).toBe(good.output.prophecy.statement);
    // watching never lists a source that isn't connected.
    expect(out.prophecy.watching).toEqual(['calendar']);
  });

  it('asks the judge about gate-passing drafts, feeds its reason back, and keeps the last passing draft if it never agrees', async () => {
    const judge = vi.fn().mockResolvedValue({ ok: false, reason: 'The check tests something else.' });
    generateText.mockResolvedValue(draft('people.sam_okafor'));
    const out = await generateDailyReading(ctx, { judge });
    expect(judge).toHaveBeenCalledTimes(3);
    expect(generateText.mock.calls[1]![0].prompt).toContain('A reviewer rejected it: The check tests something else.');
    expect(out.prophecy.statement).toBe('Sam will suggest a Thursday.');

    judge.mockReset().mockResolvedValueOnce(null);
    generateText.mockClear();
    await generateDailyReading(ctx, { judge });
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it('never calls the model for an empty dossier, and uses fixture templates in demo mode', async () => {
    const empty = await generateDailyReading({ ...ctx, dossier: { ...dossier, facts: [] } }, { judge: null });
    expect(empty.observation.evidenceRef).toBe('dossier.empty');
    vi.stubEnv('AI_GATEWAY_API_KEY', '');
    vi.stubEnv('VERCEL_OIDC_TOKEN', '');
    vi.stubEnv('DATABASE_URL', '');
    const demo = await generateDailyReading({ ...ctx, dossier: fixtures.dossier }, { judge: null });
    expect(resolveEvidence(fixtures.dossier, demo.observation.evidenceRef)).not.toBeNull();
    expect(generateText).not.toHaveBeenCalled();
  });
});

describe('reviewDraft', () => {
  const base = draft('people.sam_okafor').output;
  const review = (patch: Partial<DailyReadingOutput['prophecy']>, sources: SourceKind[] = ['calendar', 'spotify'], observation = base.observation) =>
    reviewDraft({ observation, prophecy: { ...base.prophecy, ...patch } }, { dossier, sources }, resolveEvidence(dossier, observation.evidenceRef));

  it('accepts a hopeful, human prophecy with a checkable condition', () => {
    expect(review({ statement: 'Sam will be the one to suggest an evening, before you think to ask.' })).toEqual([]);
    expect(
      review({
        statement: 'A voice you have never played will slip into your rotation before the month turns.',
        checkCondition: { type: 'listening_pattern', pattern: 'an artist not in the last 60 days reaches their top 5' },
      }),
    ).toEqual([]);
  });

  it('rejects clock times, digits and metric vocabulary', () => {
    expect(review({ statement: 'Sam will call at eight o\'clock.' }).join()).toContain('clock time');
    expect(review({ statement: 'You will have 3 meetings with Sam.' }).join()).toContain('digits');
    expect(review({ statement: 'Monday will remain your busiest day.' }).join()).toMatch(/metric language.*only extends a trend/);
    expect(review({}, undefined, { ...base.observation, text: 'Your weekdays start 18 minutes later on average.' }).join()).toContain('reads like a statistic');
  });

  it('rejects checkConditions the sources and dossier cannot observe', () => {
    expect(review({ checkCondition: { type: 'calendar_event_with', contact: 'alex', titleIncludes: null } }).join()).toContain('not a person in the dossier');
    expect(review({}, ['spotify']).join()).toContain('needs calendar');
    expect(review({ checkCondition: { type: 'email_from_contact', contact: 'sam_okafor', firstInThread: true } }).join()).toContain('needs mail');
    expect(
      review({ statement: 'A song will surprise you.', checkCondition: { type: 'listening_pattern', pattern: 'more meetings on the calendar than songs played' } }).join(),
    ).toContain('about listening');
  });

  it('rejects a prophecy that just restates the cited fact', () => {
    const observation = { text: 'The music runs late.', evidenceRef: 'rhythms.late_nights', sourceLabel: 'Spotify' };
    const problems = review(
      { statement: 'You will be playing music late at night again on Sunday.', checkCondition: { type: 'generic', description: 'Plays after eleven on a Sunday night' } },
      undefined,
      observation,
    );
    expect(problems.join()).toContain('restates the fact');
  });
});

describe('templatedReading', () => {
  it('holds fallbacks to the same standard as generated readings', () => {
    const facts: Dossier['facts'] = [
      ...dossier.facts,
      { id: 'rhythms.protected_time', category: 'rhythms', label: 'Protected time', value: 'Thursday mornings — never moved or cancelled, kept 13 times since 06.04', sources: ['calendar'] },
      { id: 'rhythms.first_activity', category: 'rhythms', label: 'First light', value: 'The first thing on a weekday usually lands in the early morning, steady for two months', sources: ['calendar', 'spotify'] },
      { id: 'tastes.top_artists', category: 'tastes', label: 'On repeat', value: 'Lately: Phoebe Bridgers', sources: ['spotify'] },
      { id: 'tastes.new_in_rotation', category: 'tastes', label: 'New in rotation', value: 'Ms Ray — new this month', sources: ['spotify'] },
    ];
    for (const fact of facts) {
      const only: Dossier = { ...dossier, facts: [fact] };
      const out = templatedReading({ dossier: only, localDate: '2026-09-02', sources: ['calendar', 'spotify'] });
      expect(out.observation.evidenceRef).toBe(fact.id);
      expect(reviewDraft(out, { dossier: only, sources: ['calendar', 'spotify'] }, fact), fact.id).toEqual([]);
    }
  });
});
