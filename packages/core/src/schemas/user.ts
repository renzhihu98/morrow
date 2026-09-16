import { z } from 'zod';

export const User = z.object({
  id: z.string(),
  name: z.string(),
  /** IANA timezone, e.g. `America/Los_Angeles`. */
  timezone: z.string(),
});
export type User = z.infer<typeof User>;
