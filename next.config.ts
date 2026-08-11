import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Meeting audio uploads go through a server action; the default 1MB
  // body limit rejects anything beyond ~2 minutes of opus. 16mb leaves
  // multipart headroom over the 15MB client/server cap.
  experimental: { serverActions: { bodySizeLimit: '16mb' } },
  // playwright.config.ts runs its own `next dev` (E2E_TEST_MODE=1) alongside
  // whatever dev server a human already has open on :3000. Next 16 dev
  // servers hold a per-distDir lock for the life of the process, so reusing
  // the default `.next` here would refuse to start a second instance — and
  // simply disabling that lock instead would let two processes race writes
  // into the same build cache. A distinct distDir avoids both: its own
  // lock, its own cache, the human's server untouched. No effect unless
  // E2E_TEST_MODE=1 (default `.next` is unchanged for every other command).
  //
  // Also skip the dev-server AGENTS.md auto-write here: it unconditionally
  // rewrites AGENTS.md to Next's canonical block on every `next dev` boot
  // whenever it doesn't byte-for-byte match (see
  // node_modules/next/dist/server/lib/app-info-log.js's
  // ensureAgentRulesForDev), which clobbers this repo's customized block —
  // destructive to the checked-in file for zero e2e benefit.
  ...(process.env.E2E_TEST_MODE === '1'
    ? { distDir: '.next-e2e', agentRules: false }
    : {}),
};

export default nextConfig;
