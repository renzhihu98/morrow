import {
  QUESTION_LIMIT,
  SourceKind,
  DossierCategory,
  type Message,
  type Prophecy,
  type Reading,
  type User,
} from '@morrow/core';
import { isStepCount, streamText, tool, toUIMessageStream, type ModelMessage, type StreamTextTransform, type ToolSet, type UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import type { MorrowUIMessage, StepData } from '../chat-types';
import type { Repository } from '../data';
import { searchCalendar } from '../dossier/calendar-search';
import { searchMail } from '../dossier/mail-search';
import { MODELS } from './models';
import { chatInstructions } from './prompts';
import { resolveEvidence } from './reading';
import { findTaboo, scrubTaboo, TABOO_DEFLECTION } from './taboo';

export type ChatTurn = {
  repo: Repository;
  user: User;
  reading: Reading;
  history: Message[];
  question: string;
  now: Date;
  used: number;
  abortSignal?: AbortSignal;
};

/** Stored transcript → model messages (text only; the dossier is in the instructions). */
export function toModelMessages(history: Message[]): ModelMessage[] {
  return history.flatMap((m): ModelMessage[] => {
    const text = m.parts
      .map((p) => (p.type === 'text' || p.type === 'observation' ? p.text : ''))
      .filter(Boolean)
      .join('\n');
    return text ? [{ role: m.role, content: text }] : [];
  });
}

/**
 * Drops sentences touching taboo topics from streamed text. Buffers per text part until a sentence
 * boundary, so nothing unsafe reaches the client even mid-stream.
 */
export const tabooTransform = <TOOLS extends ToolSet>(): StreamTextTransform<TOOLS> => () => {
  const buffers = new Map<string, string>();
  return new TransformStream({
    transform(part, controller) {
      if (part.type === 'text-delta') {
        const buffered = (buffers.get(part.id) ?? '') + part.text;
        const boundary = Math.max(buffered.lastIndexOf('. '), buffered.lastIndexOf('? '), buffered.lastIndexOf('! '));
        if (boundary < 0) return void buffers.set(part.id, buffered);
        const ready = scrubTaboo(buffered.slice(0, boundary + 2)).text;
        buffers.set(part.id, buffered.slice(boundary + 2));
        if (ready) controller.enqueue({ ...part, text: `${ready} ` });
        return;
      }
      if (part.type === 'text-end') {
        const rest = scrubTaboo(buffers.get(part.id) ?? '').text;
        buffers.delete(part.id);
        if (rest) controller.enqueue({ type: 'text-delta', id: part.id, text: rest });
      }
      controller.enqueue(part);
    },
  });
};

const SOURCE_FOR_CATEGORY: Record<DossierCategory, StepData['source']> = {
  rhythms: 'calendar',
  pursuits: 'calendar',
  people: 'calendar',
  places: 'calendar',
  tastes: 'spotify',
};

/** Streams a model answer into `writer`: tool calls surface as data-step, `observe` as data-observation. */
export async function writeModelAnswer(writer: UIMessageStreamWriter<MorrowUIMessage>, turn: ChatTurn): Promise<void> {
  const { repo, user, reading, now } = turn;
  const [dossier, summaries, prophecies] = await Promise.all([
    repo.getDossier(user.id),
    repo.listSummaries(user.id, 7),
    repo.listProphecies(user.id),
  ]);

  const step = (data: StepData) => writer.write({ type: 'data-step', id: data.id, data });

  const tools = {
    getDossierSection: tool({
      description: 'Read one section of the dossier (distilled facts only — never raw events).',
      inputSchema: z.object({ category: DossierCategory }),
      execute: async ({ category }, { toolCallId }) => {
        const source = SOURCE_FOR_CATEGORY[category];
        const label = category.charAt(0).toUpperCase() + category.slice(1);
        step({ id: toolCallId, source, label, detail: 'Reading…', status: 'active' });
        const facts = dossier?.facts.filter((f) => f.category === category) ?? [];
        step({ id: toolCallId, source, label, detail: `${facts.length} facts`, status: 'done' });
        return { facts, patterns: dossier?.patterns ?? [] };
      },
    }),
    getContactHistory: tool({
      description: 'What Morrow knows about one person: dossier facts and prophecies about them.',
      inputSchema: z.object({ contact: z.string().describe('Dossier contact key or name, e.g. "sam"') }),
      execute: async ({ contact }, { toolCallId }) => {
        const key = contact.trim().toLowerCase().replace(/^people\./, '').replace(/\s+/g, '_');
        const name = contact.charAt(0).toUpperCase() + contact.slice(1);
        const facts = dossier?.facts.filter((f) => f.category === 'people' && (f.id === `people.${key}` || f.id.startsWith(`people.${key}_`) || f.label.toLowerCase() === key)) ?? [];
        const source = facts[0]?.sources[0] ?? 'calendar';
        const label = source.charAt(0).toUpperCase() + source.slice(1);
        step({ id: toolCallId, source, label, detail: `${name} — reading`, status: 'active' });
        const related = prophecies.filter((p: Prophecy) => 'contact' in p.checkCondition && p.checkCondition.contact === key);
        step({ id: toolCallId, source, label, detail: `${name} — ${facts.length ? facts.map((f) => f.value).join(' · ') : 'nothing yet'}`, status: 'done' });
        return { facts, prophecies: related.map(({ number, statement, status, madeOn, resolvedAt }) => ({ number, statement, status, madeOn, resolvedAt })) };
      },
    }),
    searchCalendar: tool({
      description:
        'Search the events on their calendars that they are part of: title, calendar name, location and details. Use it for anything about a specific plan, pursuit or event (e.g. a job search → pursuit "job_search", or query "interview recruiter offer").',
      inputSchema: z.object({
        query: z.string().nullable().describe('Words to look for, any of them (e.g. "interview offer"). Null to list by pursuit or time only.'),
        pursuit: z.string().nullable().describe('A pursuit key from the dossier (the part after "pursuits."), or null.'),
        when: z.enum(['past', 'upcoming', 'all']),
      }),
      execute: async ({ query, pursuit, when }, { toolCallId }) => {
        const subject = pursuit ? (dossier?.facts.find((f) => f.id === `pursuits.${pursuit}`)?.label ?? pursuit.replace(/_/g, ' ')) : query || 'events';
        step({ id: toolCallId, source: 'calendar', label: 'Calendar', detail: `${subject} — searching`, status: 'active' });
        const aggregates = await repo.getAggregates(user.id);
        const found = searchCalendar(aggregates?.calendar ?? null, aggregates?.pursuits, { query, pursuit, when }, user.timezone, now);
        step({ id: toolCallId, source: 'calendar', label: 'Calendar', detail: `${subject} — ${found.total} ${when === 'upcoming' ? 'ahead' : when === 'past' ? 'so far' : 'found'}`, status: 'done' });
        return found;
      },
    }),
    searchMail: tool({
      description:
        'Search their email threads: subject, who, a note on what each thread is about and where it stands (waiting on them / on you). Use it for people, plans and pursuits (e.g. pursuit "job_search", or query "recruiter interview offer").',
      inputSchema: z.object({
        query: z.string().nullable().describe('Words to look for, any of them. Null to list by pursuit, person or time.'),
        pursuit: z.string().nullable().describe('A pursuit key from the dossier (after "pursuits."), or null.'),
        contact: z.string().nullable().describe('A person key or first name, or null.'),
        when: z.enum(['last_week', 'last_month', 'all']),
      }),
      execute: async ({ query, pursuit, contact, when }, { toolCallId }) => {
        const subject = pursuit ? (dossier?.facts.find((f) => f.id === `pursuits.${pursuit}`)?.label ?? pursuit.replace(/_/g, ' ')) : contact || query || 'threads';
        step({ id: toolCallId, source: 'mail', label: 'Mail', detail: `${subject} — reading`, status: 'active' });
        const aggregates = await repo.getAggregates(user.id);
        const found = searchMail(aggregates?.mail, aggregates?.pursuits, { query, pursuit, contact, when }, user.timezone, now);
        step({ id: toolCallId, source: 'mail', label: 'Mail', detail: `${subject} — ${found.total} ${found.total === 1 ? 'thread' : 'threads'}`, status: 'done' });
        return found;
      },
    }),
    getOpenProphecies: tool({
      description: 'Open prophecies with their windows and likelihoods.',
      inputSchema: z.object({}),
      execute: async (_input, { toolCallId }) => {
        const open = prophecies.filter((p) => p.status === 'open');
        step({ id: toolCallId, source: 'memory', label: 'Past readings', detail: `${open.length} prophecies still open`, status: 'done' });
        return open.map(({ number, statement, windowStart, windowEnd, likelihood, watching }) => ({ number, statement, windowStart, windowEnd, likelihood, watching }));
      },
    }),
    observe: tool({
      description: "Deliver the headline of your answer. Call exactly once, before the plain-text explanation.",
      inputSchema: z.object({
        text: z.string().describe('One or two sentences, max 30 words.'),
        evidenceRef: z.string().describe('Dossier fact or pattern id the answer rests on (a pursuit fact when you searched its events).'),
        sourceLabel: z.string().describe('Short evidence line, e.g. "Calendar · 03.04 · 04.22".'),
        sources: z.array(SourceKind).optional(),
      }),
      execute: async ({ text, evidenceRef, sourceLabel }) => {
        const safe = findTaboo(text) ? TABOO_DEFLECTION : text;
        // Grounding: cite a real dossier id when the model's ref resolves, otherwise mark it ungrounded.
        const evidence = resolveEvidence(dossier, evidenceRef);
        const ref = evidence?.id ?? (evidenceRef.startsWith('prophecies') ? evidenceRef : 'ungrounded');
        writer.write({ type: 'data-observation', id: 'answer', data: { text: safe, evidenceRef: ref, sourceLabel } });
        return evidence || ref !== 'ungrounded'
          ? { delivered: true }
          : { delivered: true, warning: 'evidenceRef is not a dossier id; do not state specifics you cannot see.' };
      },
    }),
  };

  const result = streamText({
    model: MODELS.chat,
    instructions: chatInstructions(
      { user, now, localDate: reading.localDate, dossier, summaries, prophecies },
      QUESTION_LIMIT - turn.used,
    ),
    messages: [...toModelMessages(turn.history), { role: 'user', content: turn.question }],
    tools,
    stopWhen: isStepCount(6),
    experimental_transform: tabooTransform(),
    abortSignal: turn.abortSignal,
  });

  // Tool call/result parts stay server-side; the client renders data-step / data-observation / text.
  const uiStream = toUIMessageStream({ stream: result.stream, sendStart: false, sendFinish: false }).pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        if (!chunk.type.startsWith('tool-') && chunk.type !== 'start-step' && chunk.type !== 'finish-step') controller.enqueue(chunk);
      },
    }),
  );
  writer.merge(uiStream);
}

/**
 * Real data but no model access (no AI_GATEWAY_API_KEY / VERCEL_OIDC_TOKEN): a short, honest, grounded
 * answer instead of the scripted demo story.
 */
export async function writeOfflineAnswer(writer: UIMessageStreamWriter<MorrowUIMessage>, turn: Pick<ChatTurn, 'repo' | 'user'>): Promise<void> {
  const dossier = await turn.repo.getDossier(turn.user.id);
  const fact = dossier?.facts[0];
  writer.write({ type: 'data-step', id: 'dossier', data: { id: 'dossier', source: fact?.sources[0] ?? 'memory', label: 'Dossier', detail: `${dossier?.facts.length ?? 0} facts`, status: 'done' } });
  writer.write({
    type: 'data-observation',
    id: 'answer',
    data: fact
      ? { text: `I can see this much: ${fact.label.toLowerCase()} — ${fact.value}.`, evidenceRef: fact.id, sourceLabel: fact.sources.join(' · ') }
      : { text: 'I cannot see enough of your days yet to answer that.', evidenceRef: 'dossier.empty', sourceLabel: 'No sources linked' },
  });
  const id = 'text-1';
  writer.write({ type: 'text-start', id });
  writer.write({ type: 'text-delta', id, delta: 'My voice is offline right now. Ask again later today.' });
  writer.write({ type: 'text-end', id });
}
