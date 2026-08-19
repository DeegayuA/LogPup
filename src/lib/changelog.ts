import data from './changelog.data.json'

export type ChangelogEntry = {
  version: string
  /** Calendar day, `YYYY-MM-DD`, in the author's own offset. */
  date: string
  /**
   * The commit instant, strict ISO 8601 with offset.
   *
   * Carried because this repo ships several versions in a day, and a list
   * where six rows read the same date cannot answer the only question the
   * menu is opened with: is the build I am on the one from before lunch?
   */
  at: string
  hash: string
  /** Conventional-commit type — feat / fix / docs / … — or 'other'. */
  kind: string
  change: string
}

// Generated from git by scripts/generate-changelog.mjs on every build
// (prebuild). One version per commit, auto-incrementing v0.0.N.
export const CURRENT_VERSION: string = data.current
export const VERSION_HISTORY: ChangelogEntry[] = data.versions
