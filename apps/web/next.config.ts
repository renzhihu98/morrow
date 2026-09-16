import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@morrow/core', '@morrow/tokens'],
  // Don't let `next dev` write AGENTS.md / CLAUDE.md into the app.
  agentRules: false,
};

export default nextConfig;
