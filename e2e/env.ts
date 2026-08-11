// Loads `.env.local` (and `.env`) into `process.env` for scripts that run
// outside of `next dev`/`next build` — the Playwright test runner and the
// `tsx e2e/seed.ts` CLI are plain Node processes, so unlike the app itself
// they get none of Next's automatic env-file loading. Import this module
// (for its side effect) before touching anything that reads `process.env`,
// e.g. `@/db` or `DEV_LOGIN_EMAIL`.
//
// Deliberately dependency-free (no `dotenv`): this repo doesn't declare it
// as a direct dependency, and the format we need to support is small enough
// (`KEY=value` / `KEY="value"` / `# comment` / blank lines) that hand-rolling
// avoids relying on a transitive package that could disappear on a future
// `npm install` elsewhere in the tree.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

function loadEnvFile(file: string): void {
  if (!existsSync(file)) return
  const contents = readFileSync(file, 'utf8')
  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    if (quoted) value = value.slice(1, -1)
    // Never clobber a var the shell (or playwright.config.ts's webServer.env)
    // already set — same precedence dotenv/Next.js use.
    if (process.env[key] === undefined) process.env[key] = value
  }
}

const repoRoot = path.resolve(__dirname, '..')
loadEnvFile(path.join(repoRoot, '.env'))
loadEnvFile(path.join(repoRoot, '.env.local'))
