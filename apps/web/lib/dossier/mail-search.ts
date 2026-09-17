/**
 * Mail search for chat (SPEC §10): threads with their subject, who, notes and status, from the aggregates.
 * Bodies are never stored, so never returned. Newsletters and taboo threads never come back.
 */
import { formatShortDate, getReadingDate } from '@morrow/core';
import { findTaboo } from '../ai/taboo';
import type { MailAggregates } from './mail';
import type { PursuitIndex } from './pursuits';

export type MailSearchInput = {
  query?: string | null;
  pursuit?: string | null;
  contact?: string | null;
  when: 'last_week' | 'last_month' | 'all';
  limit?: number;
};

export type MailSearchHit = {
  subject: string;
  with: string[];
  lastActivity: string;
  messages: number;
  youWroteLast: boolean;
  note: string | null;
  kind: string | null;
  status: string | null;
};

const DAY_MS = 86_400_000;

export function searchMail(
  mail: MailAggregates | null | undefined,
  pursuits: PursuitIndex | null | undefined,
  input: MailSearchInput,
  timeZone: string,
  now: Date,
): { total: number; threads: MailSearchHit[] } {
  if (!mail) return { total: 0, threads: [] };
  const words = (input.query ?? '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2);
  const contact = input.contact?.trim().toLowerCase().replace(/^people\./, '').replace(/\s+/g, '_') || null;
  const since = input.when === 'last_week' ? now.getTime() - 7 * DAY_MS : input.when === 'last_month' ? now.getTime() - 31 * DAY_MS : 0;

  const byThread = new Map<string, { people: Set<string>; count: number; lastDir: 'i' | 'o'; lastAt: string }>();
  for (const m of Object.values(mail.messages)) {
    const t = byThread.get(m.th) ?? { people: new Set<string>(), count: 0, lastDir: m.d, lastAt: m.t };
    for (const p of m.p) t.people.add(p);
    t.count += 1;
    if (m.t >= t.lastAt) Object.assign(t, { lastDir: m.d, lastAt: m.t });
    byThread.set(m.th, t);
  }

  const hits = Object.entries(mail.threads)
    .filter(([id, th]) => {
      const meta = byThread.get(id);
      if (!meta || th.k === 'newsletter' || Date.parse(th.at) < since) return false;
      const names = [...meta.people].map((k) => `${k} ${mail.names[k] ?? ''}`).join(' ');
      const haystack = `${th.s} ${th.n ?? ''} ${names}`;
      if (findTaboo(haystack)) return false;
      if (input.pursuit && pursuits?.threads?.[id] !== input.pursuit) return false;
      if (contact && ![...meta.people].some((k) => k === contact || k.startsWith(`${contact}_`) || (mail.names[k] ?? '').toLowerCase().startsWith(contact.replace(/_/g, ' ')))) return false;
      if (words.length > 0 && !words.some((w) => haystack.toLowerCase().includes(w))) return false;
      return true;
    })
    .sort((a, b) => b[1].at.localeCompare(a[1].at));

  return {
    total: hits.length,
    threads: hits.slice(0, Math.min(input.limit ?? 12, 25)).map(([id, th]) => {
      const meta = byThread.get(id)!;
      return {
        subject: th.s,
        with: [...meta.people].slice(0, 4).map((k) => mail.names[k] ?? k),
        lastActivity: formatShortDate(getReadingDate(new Date(th.at), timeZone, 0)),
        messages: meta.count,
        youWroteLast: meta.lastDir === 'o',
        note: th.n || null,
        kind: th.k ?? null,
        status: th.st ?? null,
      };
    }),
  };
}
