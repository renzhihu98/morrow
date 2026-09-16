'use client';

import { createAuthClient } from 'better-auth/react';

/** Browser Better Auth client (same origin, basePath /api/auth). */
export const authClient = createAuthClient();
