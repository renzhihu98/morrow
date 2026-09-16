/**
 * Central model ids, resolved through Vercel AI Gateway (plain `provider/model` strings).
 * Verified against https://ai-gateway.vercel.sh/v1/models on 2026-09-16:
 * `anthropic/claude-sonnet-5` and `anthropic/claude-haiku-4.5` are both listed.
 */
export const MODELS = {
  /** Daily readings and chat — Morrow's voice. */
  reading: 'anthropic/claude-sonnet-5',
  chat: 'anthropic/claude-sonnet-5',
  /** Extraction, summaries, classification. */
  summary: 'anthropic/claude-haiku-4.5',
} as const;
