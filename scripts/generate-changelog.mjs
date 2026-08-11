// Auto-generates the version history from git. Runs on `prebuild` (and can be
// run by hand). Each commit becomes a version, v0.0.N incrementing from the
// first commit, with the commit subject as "what changed in this version".
// Writes src/lib/changelog.data.json, which the app imports at build time.
import { execSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'src/lib/changelog.data.json')
const SEP = '' // unit separator — safe inside commit subjects

let log = ''
try {
  log = execSync(`git log --reverse --pretty=format:%h${SEP}%ad${SEP}%s --date=short`, {
    cwd: root,
    encoding: 'utf8',
  })
} catch {
  // No git (or shallow clone with no history) — leave any existing file in place.
  console.warn('[changelog] git log unavailable; keeping existing changelog.data.json')
  process.exit(0)
}

const versions = log
  .split('\n')
  .filter(Boolean)
  .map((line, i) => {
    const [hash, date, ...rest] = line.split(SEP)
    return { version: `v0.0.${i + 1}`, date, hash, change: rest.join(SEP) }
  })

const data = {
  current: versions.length ? versions[versions.length - 1].version : 'v0.0.1',
  versions,
}

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, `${JSON.stringify(data, null, 2)}\n`)
console.log(`[changelog] ${versions.length} versions — current ${data.current}`)
