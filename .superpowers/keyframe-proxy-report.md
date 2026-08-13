# Meeting keyframe proxy route — report

## What was built

- `src/app/api/meeting-keyframes/[...path]/route.ts` — the missing route.
  Modeled on `src/app/api/avatar/[...path]/route.ts`: same Next 16
  `{ params }: { params: Promise<{ path: string[] }> }` signature, same
  single-encoded-segment reconstruction (`path.map(decodeURIComponent).join('/')`),
  same streamed `Response(blob.stream, ...)` shape, same
  `private, max-age=3600` cache header (each keyframe gets a fresh random
  pathname, so a cached copy is always the same image that pathname ever
  pointed at), same "every miss is 404, never 401/403" posture.
- `src/features/meetings/keyframe-access.ts` — the pure authorization
  decision, `canServeKeyframe({ isAdmin, frameDeleted, meetingDeleted,
  canReadMeeting })`. The route is a thin wrapper: it resolves those four
  booleans from one DB query + `canReadMeetingIntel`, then calls this.
- `src/features/meetings/keyframe-access.test.ts` — the authorization
  matrix as unit tests (see below).
- `src/db/live.test.ts` — added the route to `ALLOWLIST` with a `// why`
  comment (the placeholder note already in that file said to re-add it
  "in the same commit that actually writes the route").

## Why a pure function instead of a route-handler test

Checked `vitest.config.ts` (`test.include: ['src/**/*.test.ts']`) and
`find src/app/api -name '*.test.ts'` — no route-handler test exists
anywhere in `src/app/api/**`, and there's no harness for driving a Next
route handler's `GET` directly. Per the task instructions, the
authorization decision was pulled into `canServeKeyframe`, a small pure
function with no DB/auth dependency, and given its own sibling
`.test.ts`. The route itself has no branching logic beyond calling this
function, so it doesn't need its own harness to be trustworthy.

## Authorization matrix (`keyframe-access.test.ts`)

| isAdmin | frameDeleted | meetingDeleted | canReadMeeting | → served? |
|---|---|---|---|---|
| true  | true  | true  | true  | **yes** (admin previewing a trashed frame from the admin Trash card) |
| false | false | false | true  | **yes** (member, live frame, live meeting, entitled) |
| false | true  | false | true  | no (member, trashed frame) |
| false | false | true  | true  | no (member, live frame but trashed meeting) |
| false | false | false | false | no (member without read access to the meeting) |
| false | false | false | false | no (no session — see note below) |
| true  | true  | true  | false | no (admin bypasses liveness, still needs canReadMeeting) |

Implementation:

```ts
export function canServeKeyframe({ isAdmin, frameDeleted, meetingDeleted, canReadMeeting }) {
  if (!canReadMeeting) return false
  return isAdmin || (!frameDeleted && !meetingDeleted)
}
```

**Note on "no session":** the route returns 404 via `if (!session?.user)`
before `canServeKeyframe` is ever called — there is no user to compute
`canReadMeetingIntel` against. That row is included in the test suite
anyway as defense-in-depth documentation (canReadMeeting is
unsatisfiable with no session, so the function still says no even if
every other flag looks servable), not because the route reaches the
function in that case.

## How the admin exception was handled

The route does **one** raw, parameterized-`eq()` join of
`meeting_screenshots` and `meetings` (never `liveScreenshots`/
`liveMeetings`) keyed on an exact match against `blobPathname`. This is
deliberate and unavoidable even for non-admins: a non-admin's "is the
MEETING trashed" check needs the real (unfiltered) `meetings.deleted_at`
too — going through `liveMeetings` would silently make a trashed meeting
(and therefore the "member+live frame but trashed meeting → no" case)
invisible before `canServeKeyframe` ever got a chance to decide. Admins
additionally get to see a trashed *frame* row this same raw read already
surfaces — `canServeKeyframe`'s `isAdmin` branch is what actually grants
that, the query itself is identical for both roles.

Because this raw read trips `src/db/live.test.ts` checks 1/2 (raw
`.from()`/`.innerJoin()` of `meetings`/`meeting_screenshots`), the route
file was added to `ALLOWLIST` with:

```ts
// why: the meeting-keyframes proxy route's admin-preview exception. An
// admin has to be able to preview a trashed keyframe from the admin Trash
// card, and a non-admin's "is the MEETING trashed" check needs the real
// meetings row too — liveScreenshots/liveMeetings would filter a
// soft-deleted row out before the route ever got a chance to look at it.
// The actual authorization decision is the pure canServeKeyframe function
// (src/features/meetings/keyframe-access.ts, unit tested directly in
// keyframe-access.test.ts); this raw read only gathers the facts it needs.
'src/app/api/meeting-keyframes/[...path]/route.ts',
```

No check was weakened — the allowlist mechanism already existed
specifically for genuine, reviewed exceptions like this one, and the
allowlist-hygiene test (`it.each(ALLOWLIST)('%s exists', ...)`) now
passes for this entry because the file is real.

## Path/pathname handling

- `decodeURIComponent` on each path segment, then joined — matches the
  avatar route and the single-encoded-segment trick `keyframeProxyUrl`
  documents at ai-actions.ts:1679-1683.
- `pathname.startsWith('meeting-keyframes/')` and `!pathname.includes('..')`
  guard, same shape as the avatar route's `avatars/` guard — belt-and-braces
  since the DB lookup below is the real gate.
- The DB lookup is `eq(meetingScreenshots.blobPathname, pathname)` — a
  parameterized exact-match query via Drizzle, never string interpolation.
- `get(pathname, { access: 'private' })` (the blob store read) is only ever
  called *after* a row has matched and `canServeKeyframe` has said yes —
  the route can't be used as an open proxy to arbitrary blobs in the
  private store.

## Verification

**`npx vitest run src/db/live.test.ts`**
```
Test Files  1 passed (1)
     Tests  18 passed (18)
```
All 7 enforcement checks green, including check 1 (no raw-read offenders
outside the allowlist) and the allowlist-hygiene scan (the new entry's
file now exists).

**`npx vitest run`** (full suite)
```
Test Files  116 passed (116)
     Tests  1927 passed (1927)
```
Baseline was ~1919; the delta is the 7 new `canServeKeyframe` tests. Zero
failures, zero baseline regressions.

**`npx tsc --noEmit`** — clean, no output.

**`npm run lint`** — 3 pre-existing errors / 20 pre-existing warnings, all
in files this change never touched (`meeting-form.tsx`, `meeting-panels.tsx`,
`note-timeline.tsx`, etc. — confirmed via `git status --porcelain` before
staging). Targeted lint on exactly the 4 changed files
(`route.ts`, `keyframe-access.ts`, `keyframe-access.test.ts`,
`src/db/live.test.ts`) is silent — no errors, no warnings.

**Live exercise against the dev server (`localhost:3000`)**

Authenticated via the repo's own dev-login credentials bypass
(`DEV_LOGIN_EMAIL` is set in `.env.local`; POSTed to
`/api/auth/callback/credentials` with a CSRF token fetched from
`/api/auth/csrf`, same mechanism `e2e/auth.setup.ts` drives through a
browser). Confirmed via `/api/auth/session` that this produced a real
admin session cookie.

Queried Neon directly for a live meeting with live keyframes (meeting
"Quick notes — Thu, Aug 13 · 12:59 PM", `deleted_at IS NULL` on both the
meeting and its two `meeting_screenshots` rows).

- `curl` with the session cookie against
  `/api/meeting-keyframes/meeting-keyframes%2F<meetingId>%2F<uuid>.jpg`
  → **200 OK**, `content-type: image/jpeg`, `cache-control: private,
  max-age=3600`, body is a genuine 1280×829 JPEG (68,904 bytes, verified
  with `file`).
- Same URL with **no cookie** → **404 Not Found**.
- Authenticated request for a **nonexistent** pathname → **404 Not Found**
  (identical shape to the auth-missing case, per the "never reveal which"
  requirement).
- **Browser verification** (Playwright, session cookie injected): loaded
  `/meetings`, opened "Notes & recording" → "Record" on the meeting with
  keyframes, scrolled to the "Screens shared" filmstrip, and screenshotted
  it. The two thumbnails render as actual captured screen content (a dark
  code-editor-like UI and a video-call grid) — not broken-image icons, not
  the `alt` text ("Shared screen at …"). This is the exact regression the
  task described (`screen-filmstrip.tsx:64`'s `<img>` previously always
  404'd) and it is now fixed and visually confirmed.

## Commit

`a15661c` — "fix: serve meeting keyframes through the missing proxy
route". Staged **only** the 4 files this task touched, by explicit path
(`git add "src/app/api/meeting-keyframes/[...path]/route.ts"
src/features/meetings/keyframe-access.ts
src/features/meetings/keyframe-access.test.ts src/db/live.test.ts`) —
never `git add -A`, never `git commit -a`, never `git stash`. Confirmed
via `git status --porcelain` both before and after that another session's
uncommitted work in `src/features/people/`, `src/features/meetings/
components/meeting-detail-dialog.tsx`, `src/features/sprints/components/
roadmap-timeline.tsx`, and `e2e/.auth/state.json` was left completely
untouched.

## Concerns / follow-ups (none blocking)

- None of the six specified authorization scenarios turned up an edge
  case the pure function doesn't already handle correctly.
- The route's raw-read allowlist entry is scoped to exactly this one
  file; it does not widen any existing exception.
- `e2e/.auth/state.json` and `test-results/.last-run.json` show as
  modified/deleted in `git status` — pre-existing local artifacts from
  another process (this task's own curl/Playwright auth run also writes
  to a session cookie flow, but never touched that file), left alone and
  unstaged.
