# Google OAuth verification — LogPup

Everything Google needs to approve the LogPup OAuth consent screen, and where each
value comes from in this repo. The code side is done; what remains is console work
only an account owner can do.

**Why verification is required at all:** LogPup requests
`https://www.googleapis.com/auth/calendar.events` ([src/lib/auth.ts:49](../src/lib/auth.ts#L49)),
which Google classifies as a **sensitive** scope. `openid`, `email`, and `profile`
are not sensitive and would need nothing. Sensitive scopes require brand
verification plus a scope justification and a demo video — but **not** a CASA
security assessment (that is restricted scopes only, which LogPup does not use).

Until verification passes, the consent screen shows the "Google hasn't verified
this app" interstitial and the app is capped at 100 users.

---

## 0. The one shortcut worth checking first

If **every** LogPup user has an `@altavision.lk` Google Workspace account, set
the OAuth app's **User type = Internal**. Internal apps skip verification
entirely — no video, no brand review, no 100-user cap.

LogPup as configured cannot use this: `ALLOWED_EMAIL_DOMAINS` spans
`altavision.lk`, `syntaxgenie.com`, `pearlcluster.lk`, `altavision.co.uk`, and
Google sign-in is open self-signup with an admin-approval gate, so personal
Gmail accounts can reach the consent screen. That means **External + verification**.

Decide this before submitting — switching later resets the review.

---

## 1. Prerequisites

| Item | Value / where |
|---|---|
| Production domain | `logpup.altavision.lk` |
| Domain ownership | Verified in [Google Search Console](https://search.google.com/search-console) under the **same Google account** that owns the Cloud project |
| `AUTH_URL` (production env) | `https://logpup.altavision.lk` |
| Authorized redirect URI | `https://logpup.altavision.lk/api/auth/callback/google` |

Google will not accept `*.vercel.app` as an authorized domain — you cannot prove
ownership of `vercel.app`. The custom domain must be live before you submit.

Search Console tip: verify `altavision.lk` as a **Domain property** (DNS TXT
record) and every subdomain, including `logpup.`, is covered at once.

---

## 2. Public URLs the reviewer will open

All three are served by `src/app/(public)/` and are excluded from the auth guard
in [src/proxy.ts](../src/proxy.ts). A reviewer fetches them with **no session** —
if any of them ever starts redirecting to `/sign-in`, verification fails.

| Console field | URL |
|---|---|
| Application home page | `https://logpup.altavision.lk/home` |
| Privacy policy link | `https://logpup.altavision.lk/privacy` |
| Terms of service link | `https://logpup.altavision.lk/terms` |

Verify after each deploy:

```bash
for p in home privacy terms; do
  echo -n "/$p -> "; curl -s -o /dev/null -w '%{http_code}\n' "https://logpup.altavision.lk/$p"
done
# every line must print 200. A 307 means the proxy matcher regressed.
```

---

## 3. App logo

Google wants a square **120x120 PNG, under 1 MB**, and the mark must match what
users see in the app and on the site.

```bash
curl -o logpup-120.png "https://logpup.altavision.lk/pwa-icon?size=120"
```

Generated from the same paw as the PWA icons ([src/lib/brand.ts](../src/lib/brand.ts)),
so the consent screen, installed app, and website stay consistent — which is
exactly what brand verification checks.

The Alta Vision corporate mark is separate: it sits in the footer of the public
pages, from `public/altavision-logo.svg`. **That file is a placeholder wordmark —
replace it with the real asset before submitting**, keeping the same path and a
roughly 5.5:1 aspect ratio (or update the dimensions in
[src/components/brand/alta-vision-logo.tsx](../src/components/brand/alta-vision-logo.tsx)).

---

## 4. Consent screen fields

Google Cloud Console → **Google Auth Platform** → *Branding* / *Audience* / *Data access*.

| Field | Value |
|---|---|
| App name | `LogPup` |
| User support email | `deeghayus@altavision.lk` |
| App logo | `logpup-120.png` from step 3 |
| Application home page | `https://logpup.altavision.lk/home` |
| Privacy policy link | `https://logpup.altavision.lk/privacy` |
| Terms of service link | `https://logpup.altavision.lk/terms` |
| Authorized domain | `altavision.lk` |
| Developer contact | `deeghayus@altavision.lk` |
| User type | External |

The app name must match the name on the site and in the video. "LogPup"
everywhere — not "LogPup by Alta Vision", not "Alta Vision LogPup".

---

## 5. Scopes and justifications

Declare exactly these four. Requesting anything you cannot demonstrate in the
video is the most common rejection.

| Scope | Sensitivity |
|---|---|
| `openid` | non-sensitive |
| `.../auth/userinfo.email` | non-sensitive |
| `.../auth/userinfo.profile` | non-sensitive |
| `https://www.googleapis.com/auth/calendar.events` | **sensitive** |

Justification to paste for `calendar.events`:

> LogPup is an internal engineering-operations tool used by Alta Vision (Pvt) Ltd
> and its partner teams to plan work and run team meetings. When a user schedules
> a meeting inside LogPup, LogPup creates the corresponding event on that user's
> own Google Calendar and invites the attendees the user selected, so the meeting
> appears in the calendar the team already lives in. When the user edits or
> cancels the meeting in LogPup, LogPup updates or deletes the same event.
>
> The `calendar.events` scope is the narrowest scope that permits this. Read-only
> scopes cannot create events, and `calendar` (full) grants access to calendar
> settings and calendar lists that LogPup neither needs nor uses. LogPup does not
> read, index, or analyse events it did not create, does not sell or transfer
> Google user data, and does not use it for advertising or model training.

Where this happens in the code, if a reviewer asks:
[src/features/calendar/google-calendar.ts](../src/features/calendar/google-calendar.ts)
and [src/features/meetings/actions.ts](../src/features/meetings/actions.ts).

---

## 6. Demo video

Upload to YouTube as **Unlisted** (not Private — reviewers cannot open Private).
Record in English, screen only, no cuts, and show the URL bar throughout so the
domain is visible.

Sequence, in this order:

1. Start on `https://logpup.altavision.lk/home` — show the domain in the URL bar
   and the "Why LogPup asks for your Google Calendar" section.
2. Click **Sign in**, then **Continue with Google**.
3. **Show the full OAuth consent screen** — the app name, the logo, and the
   Calendar permission text must all be legible. Google rejects videos that skip
   or blur this. Scroll it if needed.
4. Grant consent.
5. In LogPup, schedule a meeting: pick an app, a time, and attendees, and save.
6. Open Google Calendar in a new tab and show the event LogPup just created, with
   the attendees on it.
7. Back in LogPup, change the meeting time and save; return to Google Calendar and
   show the same event updated.
8. Cancel the meeting in LogPup; show it gone from Google Calendar.
9. Finish on `https://logpup.altavision.lk/privacy`, scrolling to the "Google user
   data and Limited Use" section.

Steps 5–8 are the whole point: they prove the scope maps to a real user-visible
feature and nothing more.

---

## 7. Submit

1. Google Auth Platform → **Audience** → *Publishing status* → **Publish app**
   (Testing → In production).
2. **Prepare for verification** → fill the scope justifications and the video URL.
3. Submit.

Expect roughly 2–6 weeks. Google replies by email to the developer contact and
will usually ask at least one follow-up question — answer in the same thread;
a fresh submission goes to the back of the queue.

---

## 8. After approval

- Remove the workaround copy on the sign-in card: *"App is still in development,
  so please click unsafe and proceed if you see a warning."*
  ([src/app/sign-in/page.tsx](../src/app/sign-in/page.tsx)) — it is false and
  alarming once the app is verified.
- The 100-user cap lifts and refresh tokens stop expiring after 7 days, which is
  the practical difference users will notice: today an unverified app's Google
  refresh token dies weekly and calendar sync silently stops until re-consent.

---

## 9. Rejection reasons to pre-empt

| Reason | Already handled |
|---|---|
| Homepage redirects to a login screen | `/home` is outside the [proxy.ts](../src/proxy.ts) matcher |
| Privacy policy not on the app's domain | `/privacy` is served by the app itself |
| Privacy policy missing the Limited Use disclosure | Verbatim in §4 of `/privacy` |
| Homepage doesn't link to the privacy policy | Header and footer of every public page |
| Homepage doesn't explain the app | `/home` says what LogPup is and why it wants Calendar |
| Logo doesn't match the app | Both generated from the same paw mark |
| Video doesn't show the consent screen | Step 3 above |
| Scope requested but not demonstrated | Only `calendar.events` is sensitive, and steps 5–8 demo it |
| Alta Vision logo is a placeholder | **Open — replace `public/altavision-logo.svg`** |
