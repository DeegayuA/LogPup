/**
 * GitHub App configuration, read once from the environment.
 *
 * A GITHUB APP, deliberately not the OAuth sign-in credential: the App is
 * installed on the org, so commit history keeps working for people who never
 * signed in with GitHub and after somebody leaves. The OAuth pair in
 * src/lib/auth.ts is a sign-in convenience; this is the data credential. The
 * two are easy to conflate and the wrong one produces a feature that quietly
 * covers half the team (.env.example says the same beside the keys).
 *
 * Null until all three vars exist — every caller treats "not configured" as
 * "no commit evidence", never as an error. That is what lets this whole
 * feature ship before the credentials do.
 */

export type GithubAppConfig = {
  appId: string
  /** PEM private key. Vercel-style env vars flatten newlines to \n — undone here. */
  privateKey: string
  installationId: string
}

export function githubAppConfig(): GithubAppConfig | null {
  const appId = process.env.GITHUB_APP_ID
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID
  if (!appId || !privateKey || !installationId) return null
  return { appId, privateKey: privateKey.replace(/\\n/g, '\n'), installationId }
}

export function githubConfigured(): boolean {
  return githubAppConfig() !== null
}
