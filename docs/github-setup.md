# GitHub setup — sign-in and commit history

Two separate credentials do two separate jobs. Setting up one does not set up
the other, and the wrong one produces a feature that quietly covers half the
team.

| Job | Credential | Env vars |
| --- | --- | --- |
| "Continue with GitHub" button | OAuth App | `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET` |
| Commit history as worklog evidence | GitHub App installed on the org | `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_INSTALLATION_ID` |

Both are inert until their vars are set — nothing breaks while they are blank.

## 1. Sign-in (OAuth App)

1. GitHub → Settings → Developer settings → **OAuth Apps** → New OAuth App
   (create it under the **organization**, not a personal account, so it
   survives any one person leaving).
2. Homepage URL: the deployment URL. Authorization callback URL — one per
   environment, each its own OAuth App or an added callback:
   - dev: `http://localhost:3000/api/auth/callback/github`
   - prod: `https://<your-domain>/api/auth/callback/github`
3. Copy the client id, generate a client secret, set
   `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET`.

Sign-in only works for an email that already matches an allowed LogPup user —
GitHub is a convenience door for people already here, never a way in
(src/lib/auth.ts explains why it takes the Notion path, not the Google one).

## 2. Commit history (GitHub App)

1. GitHub → org → Settings → Developer settings → **GitHub Apps** → New
   GitHub App.
   - Name: anything ("LogPup Worklog").
   - Webhook: **off** — nothing here receives webhooks.
   - Repository permissions: **Contents: Read-only** and **Metadata:
     Read-only**. Nothing else.
2. After creating: note the **App ID** → `GITHUB_APP_ID`.
3. Generate a **private key** — downloads a `.pem`. Its full text is
   `GITHUB_APP_PRIVATE_KEY`; in Vercel paste it with literal `\n` for
   newlines (the reader undoes that).
4. **Install** the App on the org. Choose *selected repositories* and pick
   the repos that count as work — the evidence reader scans at most 50, and a
   tight installation is also the privacy boundary for private repos: the App
   sees exactly what you install it on, no per-user tokens anywhere.
5. The installation id is the number in the URL of the installation page
   (`…/settings/installations/<id>`) → `GITHUB_APP_INSTALLATION_ID`.

### Who gets commit evidence

Each person sets their own GitHub username on **/profile → GitHub**. That
name is profile metadata, never identity: no sign-in path reads it, and a
wrong name can misattribute commit *evidence* at worst, never grant access.
Once the App vars are set and a person has named themself, "Fill from my day"
on /worklog includes the commit subjects they authored that day as evidence
lines — durations stay the model's to propose and the person's to confirm.

### What was deliberately not built

- No per-user OAuth tokens for reading repos — they die when people leave and
  cover only people who signed in with GitHub.
- No commit bodies or diffs in prompts — subjects only.
- No timestamps in prompt lines — the gap between two commits is not a
  duration, and handing the model clock times invites it to pretend it is.
