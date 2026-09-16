/** Max user messages per reading (UI: `n OF 15 TODAY`). */
export const QUESTION_LIMIT = 15;
/** Local hour at which a new reading day starts (and the previous reading is sealed). */
export const DAY_CUTOFF_HOUR = 4;
/** Raw source events are deleted after this many hours. */
export const RAW_EVENT_TTL_HOURS = 24;
/** Morrow never infers or predicts about these. Enforced in the system prompt and a post-generation filter. */
export const TABOO_TOPICS = [
  'health',
  'pregnancy',
  'death',
  'money_stress',
  'relationship_breakdown',
] as const;
export type TabooTopic = (typeof TABOO_TOPICS)[number];
