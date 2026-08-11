import data from './changelog.data.json'

export type ChangelogEntry = {
  version: string
  date: string
  hash: string
  change: string
}

// Generated from git by scripts/generate-changelog.mjs on every build
// (prebuild). One version per commit, auto-incrementing v0.0.N.
export const CURRENT_VERSION: string = data.current
export const VERSION_HISTORY: ChangelogEntry[] = data.versions
