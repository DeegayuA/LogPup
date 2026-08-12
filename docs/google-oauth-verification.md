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

## Fixing the rejection (submission of 12 Aug 2026)

Google returned three findings. One had a code cause and is fixed; two are
console/DNS work that only an account owner can do.

### 1. "The website of your home page URL is not registered to you"

Nothing to do with the site's content — Google could not tie
`management.altavision.lk` to the Google account that submitted the app. Fix:

1. Open [Search Console](https://search.google.com/search-console) **signed in as
   the same Google account that owns the Cloud project**. This is the part that
   trips people up: verifying under a personal account while the project belongs
   to a work account leaves the app exactly as rejected.
2. Add `altavision.lk` as a **Domain property** (not a URL prefix property) and
   complete the DNS TXT record with whoever runs the `altavision.lk` zone. One
   Domain property covers `management.` and every other subdomain.
3. Wait for verification to report success, then in Google Cloud Console →
   Google Auth Platform → *Branding*, confirm `altavision.lk` appears under
   **Authorized domains**. The console reads that list from Search Console; it
   will not accept a domain it cannot see verified.

### 2. "Your home page does not explain the purpose of your app" — FIXED IN CODE

The reviewer opened `https://management.altavision.lk` and was bounced to the
sign-in screen, so there was nothing there to read. [src/proxy.ts](../src/proxy.ts)
now **rewrites** the bare origin to the public home page for signed-out visitors
— a rewrite rather than a redirect, so the explanation is served at the exact URL
registered on the consent screen instead of at a URL the reviewer got moved to.

Set **Application home page** to the bare origin `https://management.altavision.lk`.
Confirm after deploying:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://management.altavision.lk
# must be 200, NOT 307
curl -s https://management.altavision.lk | grep -o 'LogPup' | head -1
# must print LogPup
```

### 3. "The app name 'log-pup' does not match the app name on your home page"

`log-pup` appears nowhere in this repo — it is the name Google auto-derived from
the Cloud **project id**, and it stayed on the consent screen. Fix in Google Auth
Platform → *Branding* → **App name** → `LogPup`. Exactly that: one word, capital
L, capital P.

The home page side is fixed too — `LogPup` is now the `<h1>` on
[/home](../src/app/\(public\)/home/page.tsx) rather than appearing only in the
header chrome, so the string the checker compares against is unmissable.

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
| Production domain | `management.altavision.lk` |
| Domain ownership | Verified in [Google Search Console](https://search.google.com/search-console) under the **same Google account** that owns the Cloud project |
| `AUTH_URL` (production env) | `https://management.altavision.lk` |
| Authorized redirect URI | `https://management.altavision.lk/api/auth/callback/google` |
| Authorized JavaScript origin | `https://management.altavision.lk` (and `http://localhost:3000` for dev) |

That last row is required by **Google One Tap** — the prompt on `/sign-in` that
offers an already-signed-in Google account without a redirect. If the origin is
missing, One Tap does not error; it simply never appears, and the only symptom
is a `GSI_LOGGER` line in the browser console. The full button keeps working
either way.

One Tap authenticates but does **not** authorize: it returns an ID token with no
`calendar.events` scope and no refresh token. A user whose first-ever sign-in is
One Tap therefore has no Calendar grant, and scheduling a meeting will fail for
them until they press "Continue with Google" once. That is why the button stays
the primary path on the card, and why One Tap needs no separate mention in the
verification submission — it uses the same client id and grants nothing extra.

Google will not accept `*.vercel.app` as an authorized domain — you cannot prove
ownership of `vercel.app`. The custom domain must be live before you submit.

Search Console tip: verify `altavision.lk` as a **Domain property** (DNS TXT
record) and every subdomain, including `management.`, is covered at once.

---

## 2. Public URLs the reviewer will open

All three are served by `src/app/(public)/` and are excluded from the auth guard
in [src/proxy.ts](../src/proxy.ts). A reviewer fetches them with **no session** —
if any of them ever starts redirecting to `/sign-in`, verification fails.

| Console field | URL |
|---|---|
| Application home page | `https://management.altavision.lk` (the bare origin — it now serves the public home page) |
| Privacy policy link | `https://management.altavision.lk/privacy` |
| Terms of service link | `https://management.altavision.lk/terms` |

Verify after each deploy:

```bash
for p in home privacy terms; do
  echo -n "/$p -> "; curl -s -o /dev/null -w '%{http_code}\n' "https://management.altavision.lk/$p"
done
# every line must print 200. A 307 means the proxy matcher regressed.
```

---

## 3. App logo

Google wants a square **120x120 PNG, under 1 MB**, and the mark must match what
users see in the app and on the site.

```bash
curl -o logpup-120.png "https://management.altavision.lk/pwa-icon?size=120"
```

Generated from the same paw as the PWA icons ([src/lib/brand.ts](../src/lib/brand.ts)),
so the consent screen, installed app, and website stay consistent — which is
exactly what brand verification checks.

The Alta Vision corporate mark is separate — it says who *makes* LogPup, where the
paw says what the app *is*, and both appear together rather than one replacing the
other. It is the official flat mark from `altavision.lk`, stored at
`public/altavision-logo.webp` (3774x607, alpha) and rendered by
[src/components/brand/alta-vision-logo.tsx](../src/components/brand/alta-vision-logo.tsx)
in the public-page footer, the app sidebar, the mobile nav drawer, and the sign-in
panel. Keep the alpha channel if you ever re-export it: a flattened file shows a
white plate on the dark sidebar.

---

## 4. Consent screen fields

Google Cloud Console → **Google Auth Platform** → *Branding* / *Audience* / *Data access*.

| Field | Value |
|---|---|
| App name | `LogPup` |
| User support email | `deeghayus@altavision.lk` |
| App logo | `logpup-120.png` from step 3 |
| Application home page | `https://management.altavision.lk` (the bare origin — it now serves the public home page) |
| Privacy policy link | `https://management.altavision.lk/privacy` |
| Terms of service link | `https://management.altavision.lk/terms` |
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

1. Start on `https://management.altavision.lk` — show the bare domain in the URL bar
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
9. Finish on `https://management.altavision.lk/privacy`, scrolling to the "Google user
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
| Branding inconsistent between app and site | Real Alta Vision mark ships in the app shell, sign-in, and public pages |
