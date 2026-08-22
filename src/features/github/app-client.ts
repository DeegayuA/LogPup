import { createSign } from 'node:crypto'

import { githubAppConfig } from '@/features/github/config'
import { toCommitEvidence, type CommitEvidence, type GithubCommitRow } from '@/features/github/commits'

/**
 * Thin transport to GitHub as an installed GitHub App. No SDK on purpose —
 * the three calls below are plain REST, and a dependency that exists to save
 * thirty lines would still need this file for the JWT.
 *
 * Every public function here returns empty rather than throwing when the app
 * is unconfigured or GitHub is unreachable: commit history is EVIDENCE for a
 * worklog draft, and evidence going missing must degrade the draft, never
 * break it.
 */

const API = 'https://api.github.com'

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

/**
 * The App's own JWT — RS256, signed with the App private key. Ten minutes is
 * GitHub's maximum lifetime; iat is backdated 60s because GitHub rejects
 * tokens from clocks even slightly ahead of its own.
 */
function appJwt(appId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }))
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${payload}`)
  return `${header}.${payload}.${b64url(signer.sign(privateKey))}`
}

/**
 * Installation tokens last an hour; cached until five minutes before expiry.
 * Module-level cache is safe here: the token is scoped to the one installed
 * app, not to any user.
 */
let cachedToken: { token: string; expiresAtMs: number } | null = null

async function installationToken(): Promise<string | null> {
  const config = githubAppConfig()
  if (!config) return null
  if (cachedToken && Date.now() < cachedToken.expiresAtMs - 5 * 60 * 1000) {
    return cachedToken.token
  }
  const res = await fetch(`${API}/app/installations/${config.installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${appJwt(config.appId, config.privateKey)}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!res.ok) {
    console.error(`[github] installation token refused: HTTP ${res.status}`)
    return null
  }
  const body = (await res.json()) as { token: string; expires_at: string }
  cachedToken = { token: body.token, expiresAtMs: new Date(body.expires_at).getTime() }
  return body.token
}

async function gh(path: string, token: string): Promise<Response> {
  return fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
}

/** How many repos one evidence read will scan. Logged when exceeded — a cap
 *  that silently truncates reads as "covered everything" when it didn't. */
const REPO_SCAN_LIMIT = 50

/**
 * Commits authored by one GitHub login across every repo the App can see,
 * inside [sinceIso, untilIso). One request per repo — bounded by
 * REPO_SCAN_LIMIT, and org installations are normally scoped to the repos
 * that matter, which is also the recommended install shape in
 * docs/github-setup.md.
 */
export async function commitsByAuthor(
  login: string,
  sinceIso: string,
  untilIso: string,
): Promise<CommitEvidence[]> {
  const token = await installationToken()
  if (!token) return []

  try {
    const repoRes = await gh('/installation/repositories?per_page=100', token)
    if (!repoRes.ok) {
      console.error(`[github] repository list refused: HTTP ${repoRes.status}`)
      return []
    }
    const repoBody = (await repoRes.json()) as {
      total_count: number
      repositories: { full_name: string }[]
    }
    const repos = repoBody.repositories.map((r) => r.full_name)
    if (repoBody.total_count > repos.length || repos.length > REPO_SCAN_LIMIT) {
      console.warn(
        `[github] scanning ${Math.min(repos.length, REPO_SCAN_LIMIT)} of ${repoBody.total_count} installed repos — narrow the App installation or raise REPO_SCAN_LIMIT`,
      )
    }

    const all: CommitEvidence[] = []
    for (const repo of repos.slice(0, REPO_SCAN_LIMIT)) {
      const query = `author=${encodeURIComponent(login)}&since=${encodeURIComponent(sinceIso)}&until=${encodeURIComponent(untilIso)}&per_page=100`
      const res = await gh(`/repos/${repo}/commits?${query}`, token)
      // 409: a repository with no commits at all. Not an error worth a line.
      if (res.status === 409) continue
      if (!res.ok) {
        console.error(`[github] commits for ${repo} refused: HTTP ${res.status}`)
        continue
      }
      const rows = (await res.json()) as GithubCommitRow[]
      all.push(...toCommitEvidence(rows, repo))
    }
    return all
  } catch (error) {
    console.error('[github] commit read failed:', error)
    return []
  }
}
