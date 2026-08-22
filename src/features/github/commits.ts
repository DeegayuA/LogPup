/**
 * The shape of one commit as worklog evidence, and the pure mapping from
 * GitHub's REST rows into it. Pure so it is testable without a network and so
 * the client (app-client.ts) stays a thin transport.
 */

export type CommitEvidence = {
  /** owner/name, as GitHub prints it. */
  repo: string
  sha: string
  /** First line of the message only — the subject is the evidence; a wall of
   *  body text would be pasted into an AI prompt verbatim. */
  message: string
  authoredAtIso: string
  url: string
}

/** The fields actually read off GitHub's commit-list response. */
export type GithubCommitRow = {
  sha: string
  html_url: string
  commit: {
    message: string
    author?: { date?: string } | null
    committer?: { date?: string } | null
  }
}

export function toCommitEvidence(rows: GithubCommitRow[], repo: string): CommitEvidence[] {
  const mapped: CommitEvidence[] = []
  for (const row of rows) {
    // Author date over committer date: the worklog asks when the work was
    // done, and a rebase or merge rewrites the committer stamp but not the
    // author's. A row with neither has no place on a timeline — dropped.
    const authoredAtIso = row.commit.author?.date ?? row.commit.committer?.date
    if (!authoredAtIso) continue
    mapped.push({
      repo,
      sha: row.sha,
      message: row.commit.message.split('\n', 1)[0].trim(),
      authoredAtIso,
      url: row.html_url,
    })
  }
  return mapped
}

/**
 * Commits as prompt lines, oldest first — the order the day happened in.
 * Time-of-day is deliberately absent: commit timestamps say when work was
 * PUSHED into history, not how long it took, and giving the model clock times
 * invites it to invent durations from gaps.
 */
export function commitPromptLines(commits: CommitEvidence[]): string[] {
  return [...commits]
    .sort((a, b) => a.authoredAtIso.localeCompare(b.authoredAtIso))
    .map((c) => `- [${c.repo}] ${c.message}`)
}
