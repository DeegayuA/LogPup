#!/usr/bin/env node
/**
 * Typecheck the COMMIT, not the working tree.
 *
 * Every other gate in this repo — tsc, vitest, eslint, `next build` — resolves
 * against the files on disk. That makes a whole class of breakage invisible
 * locally and fatal on deploy, because the deploy builds from the pushed
 * commit:
 *
 *   - a file importing a module its author has on disk but never staged
 *   - a registration whose only fix is sitting dirty in someone's editor
 *   - two commits that are each fine alone and contradict each other at HEAD
 *
 * All three happened here in one evening across parallel sessions, and every
 * local suite stayed green through all of them. `src/lib/tracked-imports.test.ts`
 * catches the first shape as a unit test; this catches the general case, by
 * checking HEAD out into a throwaway worktree and typechecking it in isolation.
 *
 * Non-destructive: adds a detached worktree under the system temp dir, symlinks
 * node_modules rather than installing, and removes the worktree afterwards even
 * on failure. Touches nothing in your working tree.
 *
 *   npm run verify:head            # HEAD
 *   npm run verify:head -- <ref>   # any ref: origin/main, a SHA, a branch
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ref = process.argv[2] ?? 'HEAD'
const repo = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
const sha = execFileSync('git', ['rev-parse', '--short', ref], { encoding: 'utf8' }).trim()

/**
 * Errors naming these are artefacts of the method, not defects: `LayoutProps`
 * and `PageProps` are globals Next generates into `.next/types` during a build,
 * and a fresh worktree has never been built, so it cannot have them.
 *
 * Filtering them is the difference between a check people trust and one they
 * learn to skim past — but the list stays SHORT and specific on purpose. A
 * broad filter here would hide the errors this exists to find.
 */
const GENERATED_GLOBALS = /Cannot find name '(LayoutProps|PageProps)'/

const dir = mkdtempSync(join(tmpdir(), 'logpup-verify-head-'))
let failed = false

try {
  execFileSync('git', ['worktree', 'add', '--detach', dir, ref], { stdio: 'pipe' })
  // Symlink rather than install: a fresh `npm ci` would take minutes and answer
  // a different question (does the lockfile resolve) than the one being asked.
  symlinkSync(join(repo, 'node_modules'), join(dir, 'node_modules'), 'dir')

  const tsc = spawnSync('npx', ['tsc', '--noEmit'], { cwd: dir, encoding: 'utf8' })
  const real = (tsc.stdout ?? '')
    .split('\n')
    .filter((line) => line.trim() && !GENERATED_GLOBALS.test(line))

  if (real.length) {
    failed = true
    console.error(`\n✗ ${ref} (${sha}) does NOT typecheck as a standalone commit:\n`)
    for (const line of real) console.error(`  ${line}`)
    console.error(
      `\n${real.length} error(s). A local tsc run cannot see these — it reads your working\n` +
        `tree, where the missing piece is usually present but unstaged.\n`,
    )
  } else {
    console.log(`✓ ${ref} (${sha}) typechecks as a standalone commit.`)
  }
} finally {
  // `--force` because the symlinked node_modules counts as an untracked change.
  spawnSync('git', ['worktree', 'remove', '--force', dir], { stdio: 'ignore' })
  rmSync(dir, { recursive: true, force: true })
}

process.exit(failed ? 1 : 0)
