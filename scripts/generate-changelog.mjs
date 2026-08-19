// Auto-generates the version history from git. Runs on `prebuild` (and can be
// run by hand). Each commit becomes a version, v0.0.N incrementing from the
// first commit, with the commit subject as "what changed in this version".
// Writes src/lib/changelog.data.json, which the app imports at build time.
//
// The commit TIME is carried, not just the day: this repo ships many versions
// in one day, and a list where six rows all read "2026-08-20" cannot answer
// "is the build I am looking at the one from before lunch?" — which is the
// only question anyone opens this menu with. `%aI` is strict ISO 8601 with the
// author's offset, so the app can render it in Asia/Colombo without guessing.
//
// The conventional-commit prefix is split out too (feat / fix / docs / …), so
// the menu can group and label rather than making a reader parse the prefix
// out of every line themselves.
import { execSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'src/lib/changelog.data.json')
const SEP = '' // unit separator — safe inside commit subjects

let log = ''
try {
  log = execSync(`git log --reverse --pretty=format:%h${SEP}%ad${SEP}%aI${SEP}%s --date=short`, {
    cwd: root,
    encoding: 'utf8',
  })
} catch {
  // No git (or shallow clone with no history) — leave any existing file in place.
  console.warn('[changelog] git log unavailable; keeping existing changelog.data.json')
  process.exit(0)
}

// The types worth naming in the menu. Anything else — or a subject with no
// prefix at all — becomes 'other' rather than being dropped: a version that
// exists must be listed, whatever its message looks like.
const KINDS = ['feat', 'fix', 'docs', 'refactor', 'perf', 'test', 'chore', 'style', 'build', 'ci']

function splitSubject(subject) {
  const match = /^(\w+)(?:\([^)]*\))?!?:\s*(.+)$/.exec(subject)
  if (match && KINDS.includes(match[1])) return { kind: match[1], change: match[2] }
  return { kind: 'other', change: subject }
}

const versions = log
  .split('\n')
  .filter(Boolean)
  .map((line, i) => {
    const [hash, date, at, ...rest] = line.split(SEP)
    const subject = rest.join(SEP).trim()
    // A subject of '.' or '' is a real commit with no message. Saying so beats
    // printing a lone full stop and beats hiding the version, which would make
    // the numbers skip and read as a broken list.
    const { kind, change } =
      subject && subject !== '.'
        ? splitSubject(subject)
        : { kind: 'other', change: 'No description recorded for this build.' }
    return { version: `v0.0.${i + 1}`, date, at, hash, kind, change }
  })

const data = {
  current: versions.length ? versions[versions.length - 1].version : 'v0.0.1',
  versions,
}

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, `${JSON.stringify(data, null, 2)}\n`)
console.log(`[changelog] ${versions.length} versions — current ${data.current}`)
