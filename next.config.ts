import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Meeting audio uploads go through a server action; the default 1MB body
  // limit rejects anything beyond ~2 minutes of opus. Recording is now
  // SEGMENTED (~5 minutes per upload, ~1.2MB at the 32kbps mono Opus the
  // recorder uses — see SEGMENT_TARGET_MS in
  // src/features/meetings/recording-segments.ts) instead of one blob for
  // the whole meeting, so 8mb is comfortably above a single segment
  // (~6.5x headroom for multipart overhead and bitrate variance) — do NOT
  // "optimize" this back toward the old whole-recording size; a multi-hour
  // meeting now never needs more than one segment's worth of body size at a
  // time, no matter how long the meeting runs.
  experimental: {
    serverActions: { bodySizeLimit: '8mb' },
    // STALE-WHILE-REVALIDATE for navigation.
    //
    // Every route in this app is dynamic — they all read the session — and
    // Next's default client-cache TTL for a dynamic segment is 0. That makes
    // the prefetch it already did for every in-viewport <Link> almost
    // worthless: the payload is thrown away, so bouncing People → a person →
    // back to People pays for the full page again, every time, including via
    // the Back button.
    //
    // 30s is long enough to cover the "check a detail and come straight back"
    // loop this app is mostly made of, and short enough that nothing anyone
    // reads here can drift meaningfully within it. It is NOT a correctness
    // risk after a write: every mutating action calls `revalidatePath`, which
    // invalidates these cached segments rather than waiting them out, so a
    // change you just made is never what this serves you.
    //
    // The honest limit: this serves cached segments instantly for the window,
    // it does not refetch them in the background. True background
    // revalidation needs `cacheComponents: true` plus `use cache` +
    // `cacheTag` on the queries and `revalidateTag(tag, 'max')` in the
    // actions — a real migration (see
    // node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md),
    // and the next step from here rather than something to half-do now.
    staleTimes: { dynamic: 30, static: 300 },
  },
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
