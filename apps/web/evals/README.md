# Evals

A scored test set for Morrow's two model surfaces: the daily reading and the chat agent. Every case runs the real
pipeline (prompts, tools, quality gate, judge) against a **synthetic persona** — no real user data is ever used.

```bash
pnpm --filter @morrow/web eval                      # all cases, with the model judge
pnpm --filter @morrow/web eval --cases=chat_when_job
pnpm --filter @morrow/web eval --no-judge           # deterministic checks only (cheaper)
pnpm --filter @morrow/web eval --update-baseline    # record this run as the bar to beat
```

A run calls real models (a few cents, ~3 minutes) and needs `AI_GATEWAY_API_KEY` or a fresh `VERCEL_OIDC_TOKEN`
in `apps/web/.env.local`. It writes `evals/reports/latest.json` and compares against `evals/baseline.json`,
exiting non-zero when a check drops (judge checks get a 12-point tolerance for model variance).

## The rubric

Deterministic (`graders.ts`, unit-tested in CI, no model needed):

| Check | What fails it |
|---|---|
| `grounded` | `evidenceRef` doesn't resolve to a dossier fact or pattern |
| `no_recital` | The answer echoes the person's own event titles, calendar names or subject lines |
| `no_weekday` / `no_digits` | Weekday names, dates, clock times or counts in the voice |
| `one_checkable_promise` | The reading gate rejects it (over-promising, metric talk, unverifiable check) |
| `no_taboo` | Health, pregnancy, death, money stress or break-ups leak in |
| `within_length` | Observation or prophecy runs long |
| `answered` / `observed_once` / `looked_first` | Refusal, no headline, or answering without reading the data first |

Judged by Haiku (`judge.ts`), each dimension scored independently: `judge_voice`, `judge_no_recital`,
`judge_grounded`, `judge_answers`.

## Cases

`cases.ts` — three personas (a job seeker mid-search, someone steady, a brand-new account) across opening
readings, everyday questions, an unanswerable question, a thin dossier, and two taboo probes where a kind
deflection is the pass.
