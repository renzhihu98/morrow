/**
 * Eval runner: `pnpm --filter @morrow/web eval [--suite core|redteam|all] [--cases a,b] [--no-judge] [--update-baseline]`.
 *
 * Runs the real pipeline (Sonnet readings, the chat agent with its tools) against synthetic personas, scores every
 * answer against the rubric in `graders.ts` plus the model judge, prints a table, writes `evals/reports/latest.json`
 * and compares the run with `evals/baseline.json` — a drop in any check fails the run (exit 1).
 *
 * It calls real models: one run costs a few cents and takes a couple of minutes.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Message, Reading, ReadingSummary, Prophecy, User } from '@morrow/core';
import { createUIMessageStream } from 'ai';
import type { Repository } from '../lib/data';
import type { DossierAggregates } from '../lib/dossier/aggregates';
import { ALL_CASES, CASES, RED_TEAM, type EvalCase } from './cases';
import { gradeAttack, gradeChat, gradeReading, type Check, type ChatAnswer } from './graders';
import { judge } from './judge';
import { EVAL_NOW, type Persona } from './personas';

const here = dirname(fileURLToPath(import.meta.url));
const envFile = join(here, '..', '.env.local');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const arg = (name: string): string | null => {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  return hit ? (hit.includes('=') ? hit.split('=').slice(1).join('=') : '') : null;
};

/** The slice of Repository the chat agent reads; everything else throws if the agent ever reaches for it. */
function personaRepository(persona: Persona): Repository {
  const unsupported = (name: string) => () => {
    throw new Error(`eval repository: ${name} is not available`);
  };
  return new Proxy(
    {
      kind: 'memory',
      async getDossier() {
        return persona.dossier;
      },
      async getAggregates(): Promise<DossierAggregates> {
        return persona.aggregates;
      },
      async listSummaries(): Promise<ReadingSummary[]> {
        return [];
      },
      async listProphecies(): Promise<Prophecy[]> {
        return [];
      },
      async listMessages(): Promise<Message[]> {
        return [];
      },
      async getUser(): Promise<User> {
        return persona.user;
      },
    } as Partial<Repository>,
    { get: (target, prop: string) => (prop in target ? (target as Record<string, unknown>)[prop] : unsupported(prop)) },
  ) as Repository;
}

const readingOf = (persona: Persona): Reading => ({
  id: `r_eval_${persona.id}`,
  localDate: '2026-09-17',
  timezone: persona.user.timezone,
  status: 'open',
  headline: '',
  prophecyId: null,
  summary: null,
  questionCount: 0,
  openedAt: EVAL_NOW.toISOString(),
  sealedAt: null,
});

/** Runs the chat agent for one question and collects what the person would have seen. */
async function askMorrow(persona: Persona, question: string): Promise<ChatAnswer> {
  const { writeModelAnswer } = await import('../lib/ai/chat');
  const answer: ChatAnswer = { observation: null, text: '', toolCalls: [] };
  const stream = createUIMessageStream({
    execute: async ({ writer }) =>
      writeModelAnswer(writer, {
        repo: personaRepository(persona),
        user: persona.user,
        reading: readingOf(persona),
        history: [],
        question,
        now: EVAL_NOW,
        used: 0,
      }),
  });
  for await (const chunk of stream as AsyncIterable<{ type: string; data?: Record<string, string>; delta?: string }>) {
    if (chunk.type === 'data-step' && chunk.data?.status === 'done') answer.toolCalls.push(`${chunk.data.label}: ${chunk.data.detail}`);
    if (chunk.type === 'data-observation' && chunk.data) answer.observation = { text: chunk.data.text!, evidenceRef: chunk.data.evidenceRef! };
    if (chunk.type === 'text-delta' && chunk.delta) answer.text += chunk.delta;
  }
  return answer;
}

export type CaseResult = { id: string; question: string | null; said: string; checks: Check[]; ms: number; error?: string };

async function runCase(c: EvalCase, useJudge: boolean): Promise<CaseResult> {
  const started = Date.now();
  try {
    if (c.question === null) {
      const { generateDailyReading } = await import('../lib/ai/reading');
      const output = await generateDailyReading({
        user: c.persona.user,
        now: EVAL_NOW,
        localDate: '2026-09-17',
        dossier: c.persona.dossier,
        summaries: [],
        prophecies: [],
        sources: c.persona.sources,
      });
      const said = `${output.observation.text}\n${output.prophecy.statement}`;
      const checks = [
        ...gradeReading(output, c.persona),
        ...(c.markers ? gradeAttack(said, c.markers) : []),
        ...(useJudge ? await judge({ persona: c.persona, question: null, output: said }) : []),
      ];
      return { id: c.id, question: null, said, checks, ms: Date.now() - started };
    }

    const answer = await askMorrow(c.persona, c.question);
    const said = [answer.observation?.text, answer.text].filter(Boolean).join('\n');
    // Taboo and unknowable questions are passed by an honest, in-voice refusal: the "did it answer" checks don't apply.
    const skip = c.taboo
      ? ['answered', 'grounded', 'observed_once']
      : c.refusalOk
        ? ['answered', 'grounded', 'observed_once', 'looked_first', 'judge_answers']
        : c.unknowable
          ? ['answered', 'grounded', 'judge_answers']
          : [];
    const graded = [
      ...gradeChat(answer, c.persona, { tools: c.taboo ? false : c.tools }),
      ...(c.markers ? gradeAttack([said, ...answer.toolCalls].join('\n'), c.markers) : []),
      ...(useJudge && !c.taboo ? await judge({ persona: c.persona, question: c.question, output: said, toolCalls: answer.toolCalls }) : []),
    ];
    const checks = graded.filter((ch) => !skip.includes(ch.id));
    return { id: c.id, question: c.question, said, checks, ms: Date.now() - started };
  } catch (e) {
    return { id: c.id, question: c.question, said: '', checks: [{ id: 'ran', pass: false, detail: String(e) }], ms: Date.now() - started, error: String(e) };
  }
}

const rate = (results: CaseResult[], id?: string) => {
  const checks = results.flatMap((r) => r.checks).filter((c) => !id || c.id === id);
  return checks.length === 0 ? 1 : checks.filter((c) => c.pass).length / checks.length;
};

async function main() {
  const only = arg('cases');
  const useJudge = arg('no-judge') === null;
  const suite = arg('suite') ?? 'all';
  const pool = suite === 'core' ? CASES : suite === 'redteam' ? RED_TEAM : ALL_CASES;
  const cases = only ? ALL_CASES.filter((c) => only.split(',').includes(c.id)) : pool;
  if (cases.length === 0) throw new Error(`no cases matched --cases=${only}`);
  console.log(`Running ${cases.length} cases${useJudge ? ' with judge' : ''}…\n`);

  const results: CaseResult[] = [];
  for (const c of cases) {
    const result = await runCase(c, useJudge);
    results.push(result);
    const failed = result.checks.filter((ch) => !ch.pass);
    const mark = failed.length === 0 ? '✓' : '✗';
    console.log(`${mark} ${result.id} (${(result.ms / 1000).toFixed(1)}s)`);
    console.log(`   ${result.said.replace(/\n/g, '\n   ')}`);
    for (const f of failed) console.log(`   ! ${f.id}${f.detail ? `: ${f.detail}` : ''}`);
    console.log();
  }

  const checkIds = [...new Set(results.flatMap((r) => r.checks.map((c) => c.id)))].sort();
  const byCheck = Object.fromEntries(checkIds.map((id) => [id, rate(results, id)]));
  const report = {
    at: new Date().toISOString(),
    cases: cases.length,
    passRate: rate(results),
    casesFullyPassing: results.filter((r) => r.checks.every((c) => c.pass)).length / results.length,
    byCheck,
    results,
  };

  const reportsDir = join(here, 'reports');
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(join(reportsDir, 'latest.json'), `${JSON.stringify(report, null, 2)}\n`);

  console.log('Check                       rate');
  for (const id of checkIds) console.log(`${id.padEnd(28)}${(byCheck[id]! * 100).toFixed(0)}%`);
  console.log(`\nChecks passed: ${(report.passRate * 100).toFixed(1)}%  ·  cases fully clean: ${(report.casesFullyPassing * 100).toFixed(0)}%`);

  const baselinePath = join(here, suite === 'redteam' ? 'baseline.redteam.json' : 'baseline.json');
  if (only) {
    console.log('\nSubset run — baseline untouched.');
    return;
  }
  if (arg('update-baseline') !== null) {
    writeFileSync(baselinePath, `${JSON.stringify({ at: report.at, passRate: report.passRate, byCheck }, null, 2)}\n`);
    console.log(`\nBaseline updated (${(report.passRate * 100).toFixed(1)}%).`);
    return;
  }
  if (!existsSync(baselinePath)) {
    console.log('\nNo baseline yet — run with --update-baseline once this run looks right.');
    return;
  }
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as { passRate: number; byCheck: Record<string, number> };
  // Judge scores move a little run to run; only a real drop should fail a run.
  const tolerance = (id: string) => (id.startsWith('judge_') ? 0.12 : 0.01);
  const regressions = checkIds.filter((id) => byCheck[id]! < (baseline.byCheck[id] ?? 0) - tolerance(id));
  console.log(`\nBaseline: ${(baseline.passRate * 100).toFixed(1)}%  ·  now: ${(report.passRate * 100).toFixed(1)}%`);
  if (regressions.length > 0) {
    console.error(`Regressions: ${regressions.map((id) => `${id} ${(baseline.byCheck[id]! * 100).toFixed(0)}% → ${(byCheck[id]! * 100).toFixed(0)}%`).join(', ')}`);
    process.exitCode = 1;
  }
}

await main();
