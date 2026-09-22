import type { DailyReadingOutput, Dossier } from '@morrow/core';
import { describe, expect, it } from 'vitest';
import { conciseTransform, reviewHeadline } from './chat';
import { templatedReading } from './reading';
import { firstSentences, reviewConcise, reviewReadingLength, splitSentences, VOICE_LIMITS } from './voice';

const reading = (text: string, statement: string): DailyReadingOutput => ({
  observation: { text, evidenceRef: 'rhythms.late_nights', sourceLabel: 'Spotify · lately' },
  prophecy: { statement, checkCondition: { type: 'generic', description: 'A new artist reaches their top five.' }, windowDays: 7, likelihood: 0.5, watching: ['spotify'] },
});

describe('concise voice gate', () => {
  it('passes a short, plain reading', () => {
    expect(reviewReadingLength(reading('Your mornings have loosened lately. Something is being allowed to wait.', 'A voice you have not played before will slip into your rotation.'))).toEqual([]);
  });

  it('rejects a long observation, a two-sentence prophecy, semicolons and preamble', () => {
    const long = 'You have been gathering yourself for something, quietly and carefully, in the spaces between everything else you do, and it is almost time.';
    expect(reviewReadingLength(reading(long, 'Someone will write.'))[0]).toMatch(/observation is \d+ words/);
    expect(reviewReadingLength(reading('The music runs late.', 'Someone will write. You will answer.'))).toEqual(['The prophecy has 2 sentences. Use exactly one.']);
    expect(reviewConcise('The door is near; you are ready.', VOICE_LIMITS.headline, 'reading')).toEqual(['The reading chains clauses with a semicolon. Split it into short sentences.']);
    expect(reviewConcise('Ah, the door is near.', VOICE_LIMITS.headline, 'reading')[0]).toMatch(/opens with "Ah,"/);
    expect(reviewConcise('I sense that the door is near.', VOICE_LIMITS.headline, 'reading')[0]).toMatch(/preamble/);
    // "I see" and "So much" are the voice, not preamble.
    expect(reviewConcise('I see you circling a door. So much of you is ready.', VOICE_LIMITS.headline, 'reading')).toEqual([]);
  });

  it('splits and trims sentences', () => {
    expect(splitSentences('One. Two? Three! Four')).toEqual(['One.', 'Two?', 'Three!', 'Four']);
    expect(firstSentences('One. Two. Three.', 2)).toBe('One. Two.');
  });

  it('keeps every templated fallback inside the limits', () => {
    const facts: Dossier['facts'] = [
      { id: 'people.sam', category: 'people', label: 'Sam', value: 'Moved 4 times (06.08)', sources: ['calendar'] },
      { id: 'people.jo', category: 'people', label: 'Jo', value: 'Seen weekly', sources: ['calendar'] },
      { id: 'rhythms.protected_time', category: 'rhythms', label: 'Protected', value: 'kept', sources: ['calendar'] },
      { id: 'tastes.new_in_rotation', category: 'tastes', label: 'New', value: 'x', sources: ['spotify'] },
      { id: 'rhythms.late_nights', category: 'rhythms', label: 'Late', value: 'x', sources: ['spotify'] },
      { id: 'tastes.top_artists', category: 'tastes', label: 'Top', value: 'x', sources: ['spotify'] },
      { id: 'rhythms.slipping_slot', category: 'rhythms', label: 'Slip', value: 'x', sources: ['calendar'] },
      { id: 'rhythms.first_activity', category: 'rhythms', label: 'First', value: 'x', sources: ['calendar'] },
      { id: 'places.cafe', category: 'places', label: 'Cafe', value: 'x', sources: ['calendar'] },
    ];
    for (let i = 0; i < facts.length; i++) {
      const dossier: Dossier = { userId: 'u', sizeBytes: 1, rebuiltAt: '2026-09-01T00:00:00.000Z', facts: facts.slice(i), patterns: [] };
      const out = templatedReading({ dossier, localDate: '2026-09-21', sources: ['calendar', 'spotify'] });
      expect(reviewReadingLength(out), out.observation.evidenceRef).toEqual([]);
    }
  });
});

describe('chat headline gate', () => {
  const long = 'Something in you has been gathering for a long while now, quietly, beneath the careful preparing. The door is closer than your worry says. You will feel it.';

  it('sends a wordy headline back once, then shows it trimmed', () => {
    expect(reviewHeadline('I see you circling a door you have already opened.', 0)).toMatchObject({ deliver: 'I see you circling a door you have already opened.', problems: [] });
    expect(reviewHeadline(long, 0).deliver).toBeNull();
    expect(reviewHeadline(long, 1).deliver).toBe(firstSentences(long, 2));
  });

  it('keeps at most two sentences of follow-up text across the stream', async () => {
    const parts = [
      { type: 'text-start', id: 't' },
      { type: 'text-delta', id: 't', text: 'Watch for a word. It will come ' },
      { type: 'text-delta', id: 't', text: 'soon. And one more thing. And another.' },
      { type: 'text-end', id: 't' },
    ];
    const stream = new ReadableStream({ start: (c) => (parts.forEach((p) => c.enqueue(p)), c.close()) }).pipeThrough(
      conciseTransform()({} as never) as unknown as TransformStream,
    );
    let text = '';
    for await (const part of stream as unknown as AsyncIterable<{ type: string; text?: string }>) if (part.type === 'text-delta') text += part.text;
    expect(text.trim()).toBe('Watch for a word. It will come soon.');
  });
});
