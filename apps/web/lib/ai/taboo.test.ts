import { fixtures } from '@morrow/core';
import { describe, expect, it } from 'vitest';
import { findTaboo, isReadingSafe, scrubTaboo } from './taboo';

describe('taboo filter', () => {
  it('passes the canonical fixture copy', () => {
    for (const p of fixtures.prophecies) expect(findTaboo(p.statement)).toBeNull();
    for (const f of fixtures.dossier.facts) expect(findTaboo(f.value)).toBeNull();
  });

  it('detects each topic', () => {
    expect(findTaboo('You might be getting sick.')).toBe('health');
    expect(findTaboo('Are you pregnant?')).toBe('pregnancy');
    expect(findTaboo('Someone will pass away.')).toBe('death');
    expect(findTaboo('The debt is weighing on you.')).toBe('money_stress');
    expect(findTaboo('A breakup is coming.')).toBe('relationship_breakdown');
  });

  it('scrubs only the offending sentence', () => {
    const { text, removed } = scrubTaboo('Thursday is open. Your divorce is near. Choose the day yourself.');
    expect(text).toBe('Thursday is open. Choose the day yourself.');
    expect(removed).toEqual(['relationship_breakdown']);
  });

  it('rejects unsafe readings', () => {
    expect(
      isReadingSafe({
        observation: { text: 'You have been ill.', evidenceRef: 'x', sourceLabel: 'Calendar' },
        prophecy: {
          statement: 'Sam will write first.',
          checkCondition: { type: 'email_from_contact', contact: 'sam', firstInThread: true },
          windowDays: 7,
          likelihood: 0.5,
          watching: ['mail'],
        },
      }),
    ).toBe(false);
  });
});
