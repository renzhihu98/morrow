import { fixtures, type Prophecy } from '@morrow/core';
import { describe, expect, it } from 'vitest';
import { createMemoryRepository } from '../data/memory';
import type { RawEvent } from '../sources/types';
import { findEvidence, verifyProphecies, verifyUser } from './verify';

const prophecy = (over: Partial<Prophecy> = {}): Prophecy => ({
  id: 'p_0060',
  number: 60,
  statement: 'Sam will write first.',
  title: 'Sam will write first.',
  checkCondition: { type: 'email_from_contact', contact: 'sam', firstInThread: true },
  windowStart: '2026-09-16T04:00:00-07:00',
  windowEnd: '2026-10-07T04:00:00-07:00',
  likelihood: 0.71,
  watching: ['mail'],
  status: 'open',
  madeOn: '2026-09-16',
  madeInReadingId: 'r_2026-09-16',
  fulfilledInReadingId: null,
  resolvedAt: null,
  ...over,
});

const email = (over: Partial<Extract<RawEvent['payload'], { type: 'email' }>> & { at: string }): RawEvent => {
  const { at, ...payload } = over;
  return {
    id: `e_${at}`,
    userId: 'u_iris',
    sourceKind: 'mail',
    occurredAt: at,
    expiresAt: '2026-12-01T00:00:00Z',
    payload: { type: 'email', threadId: 't1', contact: 'sam', direction: 'inbound', firstInThread: true, ...payload },
  };
};

describe('email_from_contact verification', () => {
  it('fulfils on an inbound, thread-starting email from the contact inside the window', () => {
    const p = prophecy();
    const hit = email({ at: '2026-09-30T08:47:00-07:00' });
    expect(findEvidence(p, [hit])).toBe(hit);
    const [outcome] = verifyProphecies([p], [hit], new Date('2026-09-30T09:00:00-07:00'));
    expect(outcome).toMatchObject({ status: 'fulfilled', resolvedAt: hit.occurredAt });
  });

  it('ignores replies when firstInThread is required, but accepts them otherwise', () => {
    const reply = email({ at: '2026-09-30T08:47:00-07:00', firstInThread: false });
    expect(findEvidence(prophecy(), [reply])).toBeNull();
    const relaxed = prophecy({ checkCondition: { type: 'email_from_contact', contact: 'sam', firstInThread: false } });
    expect(findEvidence(relaxed, [reply])).toBe(reply);
  });

  it('ignores outbound mail, other contacts, and events outside the window', () => {
    const p = prophecy();
    const events = [
      email({ at: '2026-09-30T08:47:00-07:00', direction: 'outbound' }),
      email({ at: '2026-09-30T08:47:00-07:00', contact: 'mom' }),
      email({ at: '2026-09-10T08:47:00-07:00' }),
      email({ at: '2026-10-08T08:47:00-07:00' }),
    ];
    expect(findEvidence(p, events)).toBeNull();
  });

  it('matches contacts case-insensitively and picks the earliest match', () => {
    const later = email({ at: '2026-10-01T10:00:00-07:00', contact: 'Sam' });
    const earlier = email({ at: '2026-09-20T10:00:00-07:00', contact: 'SAM' });
    expect(findEvidence(prophecy(), [later, earlier])).toBe(earlier);
  });

  it('expires once the window closes without evidence, and leaves it open before', () => {
    const p = prophecy();
    expect(verifyProphecies([p], [], new Date('2026-10-06T12:00:00-07:00'))).toEqual([]);
    const [outcome] = verifyProphecies([p], [], new Date('2026-10-07T05:00:00-07:00'));
    expect(outcome).toMatchObject({ status: 'expired', resolvedAt: p.windowEnd });
  });

  it('skips already-resolved prophecies', () => {
    const hit = email({ at: '2026-09-30T08:47:00-07:00' });
    expect(verifyProphecies([prophecy({ status: 'fulfilled' })], [hit], new Date('2026-10-01T00:00:00Z'))).toEqual([]);
  });
});

describe('verifyUser', () => {
  it('resolves against the repository and announces in the open reading of that day', async () => {
    const repo = createMemoryRepository();
    const user = fixtures.user;
    await repo.createProphecy(user.id, prophecy({ checkCondition: { type: 'email_from_contact', contact: 'old_studio', firstInThread: true } }));
    await repo.addRawEvents([email({ at: '2026-09-30T08:55:00-07:00', contact: 'old_studio' })]);

    const outcomes = await verifyUser(repo, user, new Date('2026-09-30T09:10:00-07:00'));
    expect(outcomes.map((o) => [o.prophecy.id, o.status])).toEqual([['p_0060', 'fulfilled']]);

    const stored = (await repo.listProphecies(user.id)).find((p) => p.id === 'p_0060');
    expect(stored).toMatchObject({ status: 'fulfilled', fulfilledInReadingId: 'r_2026-09-30', resolvedAt: '2026-09-30T08:55:00-07:00' });

    const messages = await repo.listMessages(user.id, 'r_2026-09-30');
    expect(messages.at(-1)?.parts[0]).toEqual({ type: 'prophecyRef', prophecyId: 'p_0060', event: 'fulfilled' });
  });
});
