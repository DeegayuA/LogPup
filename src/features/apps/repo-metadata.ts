import 'server-only'

/**
 * Reads enough of a GitHub repository to write an app description from it.
 *
 * GITHUB_TOKEN is optional. Without it this works on public repos at GitHub's
 * unauthenticated rate limit (60/hour per server IP — far above what an admin
 * filling in a form will ever reach). With it, private repos work too, which
 * matters because GitHub answers a private repo with 404 rather than 403, so as
 * not to confirm the repo exists. That makes "private repo, no token" and "you
 * typo'd the URL" the same HTTP response, so the error below has to name both
 * possibilities instead of guessing between them.
 */

const GITHUB_API = 'https://api.github.com'
// Enough README for the model to understand the project. Past this it is mostly
// badges, contribution guides, and licence text, and every extra thousand
// characters is tokens off the user's own Gemini quota.
const README_CHAR_LIMIT = 8000

export type RepoContext = {
  owner: string
  repo: string
  /** GitHub's own one-liner. Often empty — which is why we also read the README. */
  description: string | null
  topics: string[]
  language: string | null
  readme: string | null
}

export class RepoFetchError extends Error {
  /**
   * True when the URL was a real GitHub repo path we simply could not read —
   * private, rate-limited, or momentarily unreachable. The caller answers those
   * by asking the admin to paste the README instead, which is a fix the person
   * at the keyboard can actually carry out. False means the input was never a
   * GitHub repo, and no amount of pasting will help.
   */
  readonly recoverable: boolean

  constructor(message: string, recoverable = false) {
    super(message)
    this.recoverable = recoverable
  }
}

/**
 * Accepts the shapes people actually paste: with or without protocol, with or
 * without `www.`, with a trailing `.git`, and with a deep path
 * (`/tree/main/src`) still attached from the address bar.
 */
export function parseGitHubRepo(url: string): { owner: string; repo: string } | null {
  const trimmed = url.trim()
  if (!trimmed) return null

  let parsed: URL
  try {
    parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }

  if (parsed.hostname.replace(/^www\./i, '').toLowerCase() !== 'github.com') return null

  const [owner, repoRaw] = parsed.pathname.split('/').filter(Boolean)
  if (!owner || !repoRaw) return null

  return { owner, repo: repoRaw.replace(/\.git$/i, '') }
}

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  const token = process.env.GITHUB_TOKEN
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

export async function fetchRepoContext(url: string): Promise<RepoContext> {
  const parsed = parseGitHubRepo(url)
  if (!parsed) {
    throw new RepoFetchError('Only GitHub repository URLs can be described automatically.')
  }
  const { owner, repo } = parsed

  let res: Response
  try {
    res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
      headers: githubHeaders(),
      // Generated on demand from whatever the repo says right now — a cached
      // answer would quietly describe a stale README.
      cache: 'no-store',
    })
  } catch {
    throw new RepoFetchError('Could not reach GitHub. Check the server’s network access.', true)
  }

  if (res.status === 404) {
    throw new RepoFetchError(
      process.env.GITHUB_TOKEN
        ? `Could not read ${owner}/${repo} — it may be private, or the configured GITHUB_TOKEN cannot see it.`
        : `Could not read ${owner}/${repo} — it may be private.`,
      true,
    )
  }
  if (res.status === 403 || res.status === 429) {
    throw new RepoFetchError(
      'GitHub rate limit reached. Try again shortly, or set GITHUB_TOKEN to raise the limit.',
      true,
    )
  }
  if (!res.ok) {
    throw new RepoFetchError(`GitHub returned ${res.status} for ${owner}/${repo}.`, true)
  }

  const meta = (await res.json()) as {
    description?: string | null
    topics?: string[]
    language?: string | null
  }

  return {
    owner,
    repo,
    description: meta.description?.trim() || null,
    topics: Array.isArray(meta.topics) ? meta.topics.slice(0, 12) : [],
    language: meta.language ?? null,
    readme: await fetchReadme(owner, repo),
  }
}

/**
 * A missing or unreadable README is normal, not exceptional — plenty of
 * internal repos have none. Returning null lets the caller still write a
 * description from the name, topics, and language rather than failing the whole
 * request over a file nobody promised would exist.
 */
async function fetchReadme(owner: string, repo: string): Promise<string | null> {
  try {
    const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/readme`, {
      headers: { ...githubHeaders(), Accept: 'application/vnd.github.raw' },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const text = await res.text()
    return text.slice(0, README_CHAR_LIMIT) || null
  } catch {
    return null
  }
}
