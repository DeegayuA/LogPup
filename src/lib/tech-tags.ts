// Suggestion source + pure matching logic for the Tech tags combobox
// (features/apps/components/app-form-dialog.tsx). Kept dependency-free so it
// stays trivially unit-testable and safe to import from both the client
// component and its tests without pulling in React or the db layer.
//
// The suggestion list is never a hard constraint — every function here is
// additive (filter, canonicalize) rather than validating. Free-text tags
// outside this list must keep working; this module only helps tags stay
// consistent, never blocks one that isn't recognized.

// Curated, genuinely-useful set of technologies a small software company
// (this one's based in Sri Lanka) would plausibly tag an app with. Grouped
// by category in source for readability; the exported constant is flattened
// and alphabetically sorted since consumers just need a suggestion pool, not
// the grouping. Deliberately NOT padded — every entry earns its place.
const CURATED_TECH_TAGS_RAW: readonly string[] = [
  // Languages
  'TypeScript', 'JavaScript', 'Python', 'Java', 'Kotlin', 'Swift', 'Go',
  'Rust', 'PHP', 'C#', 'Dart', 'Ruby', 'C++', 'HTML', 'CSS',
  // Frontend
  'React', 'Next.js', 'Vue', 'Nuxt', 'Angular', 'Svelte', 'Tailwind CSS',
  'React Native', 'Flutter', 'Redux',
  // Backend
  'Node.js', 'Express', 'NestJS', 'Django', 'FastAPI', 'Laravel',
  'Spring Boot', '.NET', 'Rails', 'GraphQL', 'tRPC',
  // Data
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQLite', 'Elasticsearch',
  'Prisma', 'Drizzle', 'DynamoDB',
  // Cloud / infra
  'AWS', 'Azure', 'GCP', 'Vercel', 'Docker', 'Kubernetes', 'Terraform',
  'Cloudflare', 'Firebase', 'Supabase', 'Netlify',
  // AI
  'OpenAI', 'Gemini', 'LangChain', 'TensorFlow', 'PyTorch', 'Hugging Face',
  // Tooling
  'GitHub Actions', 'Jira', 'Figma', 'Sentry', 'Stripe', 'Slack', 'Notion',
  'Linear', 'Postman',
]

export const CURATED_TECH_TAGS: readonly string[] = [...CURATED_TECH_TAGS_RAW].sort((a, b) =>
  a.localeCompare(b),
)

/**
 * Merge the curated list with tags already used across the workspace into
 * one deduplicated, sorted suggestion pool. De-duplication is
 * case-insensitive — on a collision the curated entry's casing wins (it's
 * the deliberately-chosen canonical form; a workspace row typed before this
 * feature existed, e.g. "next.js", must not spawn a second suggestion next
 * to "Next.js"). Workspace-only tags (not in the curated list) keep
 * whatever casing they were stored with, since there's no better authority
 * for those.
 */
export function mergeTagSources(
  curated: readonly string[],
  workspace: readonly string[],
): string[] {
  const byLower = new Map<string, string>()
  for (const tag of workspace) {
    const trimmed = tag.trim()
    if (!trimmed) continue
    byLower.set(trimmed.toLowerCase(), trimmed)
  }
  // Curated casing overrides any workspace variant on a case-insensitive
  // collision — applied second so it wins.
  for (const tag of curated) {
    byLower.set(tag.toLowerCase(), tag)
  }
  return [...byLower.values()].sort((a, b) => a.localeCompare(b))
}

/**
 * If `raw` case-insensitively matches an entry in `knownTags`, return that
 * entry's canonical casing. Otherwise return `raw` trimmed, unchanged — an
 * unrecognized tag is still valid free text, just not canonicalized.
 */
export function canonicalizeTag(raw: string, knownTags: readonly string[]): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed
  const lower = trimmed.toLowerCase()
  const match = knownTags.find((tag) => tag.toLowerCase() === lower)
  return match ?? trimmed
}

export const MAX_TAG_SUGGESTIONS = 8

/**
 * Suggestions for the combobox dropdown: case-insensitive substring match
 * against `query`, excluding tags already in `selected` (case-insensitive),
 * capped at `limit`. An empty (or whitespace-only) query yields no
 * suggestions — the dropdown has nothing useful to browse until the user
 * types something. Order follows `knownTags`, so a sorted input list
 * produces an alphabetical suggestion list.
 */
export function filterTagSuggestions(
  query: string,
  knownTags: readonly string[],
  selected: readonly string[],
  limit: number = MAX_TAG_SUGGESTIONS,
): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const selectedLower = new Set(selected.map((tag) => tag.toLowerCase()))
  const out: string[] = []
  for (const tag of knownTags) {
    if (out.length >= limit) break
    if (selectedLower.has(tag.toLowerCase())) continue
    if (!tag.toLowerCase().includes(q)) continue
    out.push(tag)
  }
  return out
}
