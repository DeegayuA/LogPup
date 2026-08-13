# Google integration — two-bug report

## Bug 1 — profile pictures fall back to initials

**Fix:** `src/components/ui/avatar.tsx:28` — added `referrerPolicy="no-referrer"` to the shared
`AvatarImage` primitive. `crossOrigin` was evaluated and is not needed (this is a plain display
fetch, not a canvas read, and adding it risks a *new* failure mode if Google's CDN doesn't answer
with CORS headers for a `crossorigin` request).

No other component renders a remote avatar with a bare `<img>` — grepped the whole `src` tree;
the only other bare `<img>` usages are for meeting screenshots
(`src/app/print/meetings/[id]/page.tsx`, `src/features/meetings/components/screen-filmstrip.tsx`),
which are auth-proxied blobs, not avatars, and are unaffected.

**Verification performed** (no browser automation tool was available in this session — see
"what I could not do" below):
- Authenticated as a real user via the dev-only credentials provider (curl against
  `/api/auth/callback/credentials`, session cookie obtained) and confirmed the DB-stored
  `avatar_url` for that user flows correctly into the page payload.
- Traced the actual mechanism: base-ui's `AvatarImage` never mounts a real `<img>` — it first
  probes the URL with a `new window.Image()`, mirrors `referrerPolicy`/`crossOrigin` onto that
  probe **before** setting `.src` (see `node_modules/@base-ui/react/avatar/image/useImageLoadingStatus.js`),
  and only mounts the real `<img>` once the probe reports `loaded`. This is why the SSR'd HTML
  never contains the `<img>` tag at all (confirmed by curl) — it's 100% client-driven.
- Fetched the actual compiled dev bundle the running server serves to the browser
  (`/_next/static/chunks/src_0s4m8ch._.js`) and found the literal
  `referrerPolicy: "no-referrer"` (with my comment) attached to the `AvatarImage` props object —
  i.e. this is not just source-level correct, it is the exact code the browser will execute.

**What I could not do:** no browser automation MCP tool (chrome-devtools or similar) was
connected in this session, so I could not load the app in an actual browser and take a
screenshot of the rendered avatar. The verification above (bundle inspection + library source
trace) is mechanistic proof the fix will work, not a visual confirmation. **Recommend:** open the
app, sign in as a Google-connected user, and eyeball the account-menu avatar to close the loop.

## Bug 2 — "A Google Meet room will be created … needs your Google Calendar connection"

### What was already correct (do not re-fix)

Reading `src/features/calendar/google-calendar.ts`, `src/lib/auth.ts`, and
`src/features/meetings/actions.ts`, all four things this diagnosis asked me to check were
**already implemented correctly** — this feature (`git log`: commit `d8f6857`, "feat: one-click
Google Meet link, and a share sheet for the invite") had already landed in this working tree:

1. **Scopes** — `src/lib/auth.ts`'s Google provider requests
   `openid email profile https://www.googleapis.com/auth/calendar.events`. Correct.
2. **conferenceData request** — `createCalendarEvent` sends `conferenceDataVersion: 1` as a
   top-level request parameter (confirmed against the googleapis v3 type definitions — it's a
   sibling of `requestBody`, not nested inside it) alongside
   `conferenceData.createRequest.conferenceSolutionKey.type = 'hangoutsMeet'`. Correct.
3. **Refresh token acquisition** — the Google provider's `authorization.params` sets
   `access_type: 'offline'` and `prompt: 'consent'`, and `src/lib/auth.ts`'s `signIn` callback
   writes `account.refresh_token` onto `users.google_refresh_token`. Correct.
4. **Reading the link back** — `hangoutLink ?? conferenceData.entryPoints[video].uri` is read off
   the created event and, in `syncCalendarInvite` (`src/features/meetings/actions.ts`), written to
   `meetings.meeting_url` only where the form left it blank. Correct.
5. **Honest partial-success handling** — `createMeeting` inserts the meeting row (via `db.batch`)
   *before* calling `syncCalendarInvite`, and a calendar failure only ever populates
   `calendarWarning` on the return value — it can never fail the meeting creation. This was
   already the existing pattern and I didn't need to touch it.

### The actual bug, found by a live test against a real refresh token

I could not simply trust the code read — I pulled a real Google-connected user's
`google_refresh_token` from the dev DB (`deeghayuadhikari01@gmail.com`, the account behind the
avatar URL in Bug 1's diagnosis) and called `createCalendarEvent` directly with `withMeet: true`
against the real Google Calendar API (no attendees, deleted the event immediately after via
`deleteCalendarEvent` — no real person was invited to anything).

**Result:** Google rejected it with `403 / accessNotConfigured`:

> Google Calendar API has not been used in project 48169940329 before or it is disabled. Enable
> it by visiting
> `https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview?project=48169940329`
> then retry.

This proved the request itself (scope, conferenceData, conferenceDataVersion) really is
well-formed — the failure is that **the Google Calendar API has never been enabled in this
project's Google Cloud console.** This is a genuinely different problem from "insufficient
scope," and needs a genuinely different fix (an admin enabling an API, vs. a user re-consenting).

But `describeCalendarError` (the function that turns this into the toast the user sees) got it
wrong in two compounding ways, both now fixed:

1. It read the failure `reason` at `error.errors[0].reason` — but a real googleapis error nests
   it at `error.response.data.error.errors[0].reason` (or `.details[].reason` for the newer
   ErrorInfo format). This means the `reason === 'insufficientPermissions'` check had **never
   matched anything**, for any 403, ever — confirmed live: `err.errors` was `undefined` on the
   actual thrown error.
2. Because of (1), every 403 — including this "API disabled" one — fell through to the blanket
   `status === 403` branch and returned: *"LogPup was not granted Google Calendar access — sign
   in with Google again and tick the Calendar permission."* That instruction is actively wrong
   for this failure: re-consenting changes nothing, because the problem isn't the grant, it's
   that Calendar is off at the project level. A user following that advice would sign out, sign
   back in, tick every box Google offers, and hit the exact same error again with no idea why.

**Fix, in `src/features/calendar/google-calendar.ts`:**
- Corrected the `reason`/`detailReason` extraction to read the actual nested location.
- Added a distinct branch (checked *before* the generic 403 fallback) for
  `reason === 'accessNotConfigured'` / `detailReason === 'SERVICE_DISABLED'` / the matching
  message text, returning: *"the Google Calendar API is disabled for LogPup's Google Cloud
  project — an admin needs to enable it in Google Cloud Console before Meet links can be
  created."*
- The genuine insufficient-scope path (`reason === 'insufficientPermissions'`, or the message
  containing "insufficient authentication scopes") is preserved and still returns the
  re-consent message — that one *is* fixed by re-consenting.
- Also extracted `buildConferenceDataRequest(requestId)` and `extractMeetLink(event)` as pure
  functions out of `createCalendarEvent`, and added `src/features/calendar/google-calendar.test.ts`
  (19 tests) covering: conferenceData shape, meetLink read-back precedence and fallbacks, and
  every branch of `describeCalendarError` — including a live-reproduced regression test for the
  accessNotConfigured case, a test asserting it does *not* say "sign in with Google again" for
  that case, and a test that the message never echoes anything token-derived.

### User action required — nothing else in the code can fix this

**Enable the Google Calendar API for this Google Cloud project.** Direct link (from Google's own
error, project `48169940329`):

```
https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview?project=48169940329
```

I did not do this myself — the task said Cloud-console changes are a user action, and I have no
way to know if this is the intended production project or if enabling it has billing/quota
implications you'd want to review first.

Once enabled (Google says allow "a few minutes" to propagate), the whole pipeline should already
work end-to-end for any user who already has `google_refresh_token` set with the
`calendar.events` scope — no further code changes should be needed. If it's still broken after
enabling the API, the next-most-likely cause is:
- **A stale refresh token from before the `calendar.events` scope was added** (users who
  connected Google before this scope existed hold a token that never got that grant). Fixed per
  user by signing out and back in with Google — this is exactly what the *"insufficient scopes"*
  toast path now correctly tells them to do, so it should self-surface.
- **The OAuth consent screen is still in "Testing" publishing status.** `calendar.events` is a
  sensitive scope; a Testing-mode app's refresh tokens expire after 7 days regardless of use,
  which reads as "it worked once, then stopped." That's a Cloud Console publishing-status
  decision I can't see or make on your behalf.

## Verification

- `npx vitest run` — 118 files, **1977 passed** (baseline ~1927 in the task brief; actual
  baseline observed at start of this session, before my changes, was 1958 — already higher than
  the brief's figure, presumably from other concurrent work. My 19 new tests bring it to 1977;
  zero failures either way).
- `npx tsc --noEmit` — clean.
- `npm run lint` — 3 pre-existing errors, all in `meeting-form.tsx` / `meeting-panels.tsx`
  (`react-hooks/set-state-in-effect`), none in any file I touched, none introduced by me —
  confirmed these files are untouched by my changes and not part of my working set.
- `npx vitest run src/db/live.test.ts` — 18 tests, all passed.
- Live-verified Bug 2's exact failure and fix against the real Google Calendar API using a real
  refresh token (see above) — this is the strongest verification available short of driving the
  actual UI, since it exercises the identical `createCalendarEvent` / `describeCalendarError`
  code path the app calls.
- Bug 1 verified via compiled-bundle inspection + base-ui source trace (see Bug 1 section) —
  not a rendered screenshot, since no browser automation tool was connected this session.

## Files changed

- `src/components/ui/avatar.tsx` — Bug 1 fix.
- `src/features/calendar/google-calendar.ts` — Bug 2 fix + pure-function extraction.
- `src/features/calendar/google-calendar.test.ts` — new, 19 tests.

Commits: `d0910df` (Bug 1), `3c82482` (Bug 2). Neither touches `src/lib/auth.ts`,
`src/db/schema.ts`, or any file another session had in flight in this shared working tree —
confirmed via `git diff` before staging and `git status` after committing.
