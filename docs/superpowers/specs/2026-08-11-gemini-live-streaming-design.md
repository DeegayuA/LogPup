# Gemini Live streaming transcription — design

Status: **research + decision recorded; implementation pending**
Date: 2026-08-11
Author: streaming-transcription agent

> **Note on framing.** This spec was re-scoped mid-flight. The original brief assumed
> paid Gemini usage and asked "is Live API affordable?". The operative constraint is
> actually that keys are **free-tier, per-user**, so the binding resource is **quota,
> not dollars**. The research below is organised around that. The conclusion did not
> pivot to a chunked design — but for a reason opposite to the one expected, see
> §3.

---

## 0. What I could and could not verify

Being explicit up front, because a previous agent's work in this area was correct but
unexercised and that made a bug invisible for a long time.

| Claim | Status |
| --- | --- |
| Audio is billed at 25 tokens/second | **Verified** — official pricing page |
| Live API models have a free tier | **Verified (documented)** — pricing page says "Free of charge" |
| Exact free-tier RPM/RPD numbers | **NOT VERIFIABLE** — Google no longer publishes them (§1.2) |
| Live API works on a free key end-to-end | **NOT VERIFIED** — needs a real free key; see §5 preflight |
| `inputAudioTranscription` returns user speech as text | **Verified** — documented field + response shape |
| Vercel cannot hold a 60-min relay socket | **Verified** — documented max duration |
| Anything involving real speech or real audio | **NOT TESTED** — no microphone in this environment |

---

## 1. Free-tier research (the numbers)

### 1.1 How audio is metered

From the official pricing page, verbatim: **"25 tokens per second of audio"**.

Therefore:

| Duration | Audio input tokens |
| --- | --- |
| 1 second | 25 |
| 1 minute | 1,500 |
| 1 hour | 90,000 |

### 1.2 Rate limits — Google stopped publishing the free-tier table

This is a material finding. `https://ai.google.dev/gemini-api/docs/rate-limits` **no
longer contains a free-tier limits table**. It now states only that limits are
measured across three dimensions —

> "Rate limits are usually measured across three dimensions: Requests per minute
> (RPM), Tokens per minute (input) (TPM), Requests per day (RPD)."
> "Your usage is evaluated against each limit, and exceeding any of them will trigger
> a rate limit error."

— and then defers the actual numbers to the console:

> "Rate limits depend on a variety of factors (such as your usage tier) and can be
> viewed in Google AI Studio."

The page carries **no Live-API-specific dimension** (no documented "concurrent
sessions" or "session-minutes/day" quota).

Third-party trackers were consulted and **disagree with each other** by an order of
magnitude (free-tier Flash RPD variously reported as 250, 1,000, and 1,500; RPM as 10
or 15). They are not citable and are not used for any decision below.

**Consequence for the design:** we cannot compute a reliable "you have N minutes left
today" budget, and we must not pretend to. Quota exhaustion is therefore treated as an
*expected runtime event* with a first-class recovery path (§4), not as an error case.

### 1.3 Published pricing (paid tier, per 1M tokens, audio input)

| Model | Audio input | Free tier? |
| --- | --- | --- |
| `gemini-3.1-flash-live-preview` | $3.00 (or $0.005/min) | Yes — "Free of charge" |
| `gemini-2.5-flash-native-audio-preview-12-2025` | $3.00 | Yes |
| `gemini-3.5-live-translate-preview` | $3.50 (or $0.0053/min) | Yes |
| `gemini-2.5-flash` | $1.00 | Yes |
| `gemini-2.5-flash-lite` | $0.30 | Yes |

Live native-audio models note free tier is "subject to more restrictive rate limits",
and that preview models may change before stabilising.

### 1.4 Live API session mechanics

- Audio-only session cap: **15 minutes** without compression (audio+video: 2 min).
- **WebSocket connection lifetime is ~10 minutes** regardless.
- `contextWindowCompression` (sliding window, `trigger_tokens`) lifts the session cap
  to unlimited.
- `sessionResumption` yields handles via `SessionResumptionUpdate`; handles stay valid
  **2 hours** after termination.
- A `GoAway` message with `timeLeft` warns before the server closes the connection.

**Consequence:** any recording longer than ~10 minutes *must* implement reconnect +
session resumption. This is not optional polish.

### 1.5 Transcription-only configuration (the important one)

`inputAudioTranscription: {}` in the setup message makes the server emit the **user's
own speech** as incremental text:

```
serverContent.inputTranscription.text
```

Audio is sent as base64 raw 16-bit PCM, 16 kHz, little-endian:

```json
{ "realtimeInput": { "audio": { "data": "<base64>", "mimeType": "audio/pcm;rate=16000" } } }
```

Two traps found in the docs:

1. **Native-audio models only support the `AUDIO` response modality.** Verbatim: *"The
   native audio models only support AUDIO response modality. If you need the model
   response as text, use the output audio transcription feature."* For a meeting
   recorder we do not want a spoken reply at all, so a native-audio model is the wrong
   family — use a **half-cascade Live model with `responseModalities: ["TEXT"]`**.
2. Live API is conversational — by default automatic VAD will make the model *answer*
   the meeting, burning output tokens and quota for output nobody wants. Suppress it
   with:
   ```json
   { "realtimeInputConfig": { "automaticActivityDetection": { "disabled": true } } }
   ```
   With automatic VAD disabled the model only takes a turn when the client sends
   `activityEnd`. **If we never send `activityEnd`, the model never speaks, but
   `inputTranscription` still streams.** That is the transcribe-only mode we want, and
   it is also the cheapest possible mode because output tokens stay ~zero.

### 1.6 Ephemeral tokens

- Mint: `POST https://generativelanguage.googleapis.com/v1beta/auth_tokens`, authed
  with the real key in the `x-goog-api-key` header.
- Fields: `uses` (default 1), `expireTime` (default +30 min), `newSessionExpireTime`
  (default +1 min), `liveConnectConstraints` (pins model + config to the token).
- The browser then connects using `token.name` **in place of** an API key.
- Status: **Preview**, and Live-API-only. Docs state no tier restriction, but this is
  unverified against a real free key (§0).

---

## 2. Why a server-side relay is not viable on this stack

Vercel Functions (Fluid Compute, Node runtime) max duration, from the official limits
page:

| Plan | Default | Maximum | Extended max |
| --- | --- | --- | --- |
| Hobby | 300s | **300s** | — |
| Pro / Enterprise | 300s | **800s** | 1800s (beta) |

A relay would need to hold one function invocation open for the entire recording. On
Hobby that caps a meeting at **5 minutes**; on Pro at **13.3 minutes**. Meetings are
routinely an hour. Vercel's own docs point long-lived work at Workflows, which are not
a transport for a live audio socket.

So the relay is out — not for security reasons but for hard platform reasons.
**Ephemeral tokens are the only workable transport**, and they happen to also satisfy
the security constraint: the browser receives a short-lived, single-use,
model-pinned credential and never the user's AES-encrypted Gemini key.

This is a genuinely better security posture than a relay, not a compromise: the token
is scoped by `liveConnectConstraints`, expires in minutes, and cannot be replayed
against `generateContent` to spend the user's other quota.

---

## 3. Live socket vs chunked `generateContent` — the cost comparison

### 3.1 On a paid key, chunked is far cheaper

For a 1-hour meeting (90,000 audio input tokens):

| Approach | Model | Input cost / hour |
| --- | --- | --- |
| Live socket | `gemini-3.1-flash-live-preview` | **$0.27** ($0.005/min → $0.30, consistent) |
| Chunked | `gemini-2.5-flash` | $0.09 |
| Chunked | `gemini-2.5-flash-lite` | **$0.027** |

Chunked flash-lite is **~10× cheaper in dollars** than the Live socket.

### 3.2 On a free key, that comparison is irrelevant — and inverts

Free-tier dollars are zero. The scarce resource is **requests**, and the two approaches
consume requests in wildly different ways:

| Approach | Requests consumed by ONE 1-hour meeting |
| --- | --- |
| Chunked @ 5s chunks | 720 |
| Chunked @ 15s chunks | 240 |
| Chunked @ 30s chunks | 120 |
| **Live socket** | **~6** (one connect per ~10-min socket lifetime) |

Against *any* plausible free-tier RPD (the reported candidates are 250 / 1,000 / 1,500),
chunked transcription of a single meeting consumes somewhere between a fifth and
three times the **entire day's request budget** — a budget shared with every other
Gemini feature in LogPup (meeting analysis, natural-language task capture, intent
parsing). One long meeting would leave the rest of the product dead for the day.

Chunking also strains RPM: 5-second chunks is 12 RPM sustained, at or above the
reported free-tier RPM for Flash, so it would 429 continuously *during* a meeting.

TPM is not binding for either approach: 1,500 tokens/min of audio is trivial against
any reported free-tier TPM.

**The Live socket is the quota-cheap option precisely because it is the
dollar-expensive one** — it bills tokens (free, and far below TPM) rather than
requests (scarce). This inverts the naive assumption and is the central finding.

### 3.3 Latency — chunked cannot satisfy the actual ask

The user's requirement is "show each word realtime".

- Live socket: `inputTranscription` arrives incrementally, sub-second.
- Chunked: a chunk cannot be transcribed until it is complete, so the floor on
  perceived lag is the chunk length — 15 to 30 seconds. Shrinking chunks to fix that
  is exactly what blows the RPM/RPD budget (§3.2), and it also degrades accuracy,
  because a chunk boundary mid-word or mid-sentence destroys the context that makes
  code-switched Sinhala/English resolvable at all.

Chunked is therefore not a cheaper way to deliver the feature; **it is a different,
lesser feature** — near-realtime paragraphs, not live words.

### 3.4 Recommendation

**Build the Live socket, via ephemeral tokens, behind a feature flag.** It is the only
option that meets the realtime requirement, the only one that works on iPhone, and —
counter-intuitively — the *more* free-tier-friendly of the two on the dimension that
actually binds.

**Do not build chunked `generateContent` as the fallback.** It is not a cheaper
version of the same thing; it would consume the quota that the rest of the app needs,
and it cannot deliver word-level latency. The existing **Web Speech path remains the
fallback** — it is free, consumes no Gemini quota at all, and already works for
single-language English. Falling back to it costs the user bilingual support, which
must be said plainly in the UI rather than hidden.

Degradation ladder:

```
Live socket (bilingual, realtime, costs quota)
        │  token mint fails / 429 / socket dies repeatedly
        ▼
Web Speech en-US only (free, no Gemini quota, NOT bilingual — say so)
        │  unsupported browser (iOS Safari has no si-LK)
        ▼
Record audio only + transcribe after the meeting via existing callGemini (1 request)
```

The third rung matters: **audio is always recorded locally regardless of which rung is
active**, so a transcription failure never loses the meeting. Post-hoc transcription of
a whole recording is a *single* `generateContent` request, which is quota-trivial and
reuses `callGemini` with its existing key-rotation, retry and model-fallback machinery
untouched.

---

## 4. Quota exhaustion is a first-class path

Because the real limits are unpublished (§1.2), the design cannot pre-compute a budget.
It must instead react correctly and honestly:

- A 429 on token mint, or on socket setup, is **expected**, not exceptional.
- On 429: stop the socket, keep recording audio, drop to the next rung of the ladder,
  and show a persistent (not toast-and-vanish) notice naming what was lost.
- Never silently continue showing a stale transcript while the socket is dead — that is
  precisely the failure mode that hid the Web Speech bug.
- The UI must never claim "live bilingual" unless a transcription fragment has actually
  been received on the current socket.

---

## 5. Preflight probe (resolves the #1 unverified risk)

Before the first real recording, and before showing the user a "start" affordance that
promises bilingual live transcription, mint a token server-side and attempt one short
setup handshake. This answers, with a real key, the question the docs could not:
*does the free tier actually permit `auth_tokens` + Live?*

Outcomes:
- 200 + successful setup → Live path is available; enable it.
- 403 / "not available for your tier" → Live is paid-only for this user; permanently
  fall to Web Speech for that key and record the reason.
- 429 → quota exhausted today; fall back, retry tomorrow.

---

## 6. No migration is needed

Worth stating plainly, because the brief anticipated one.

The live transcript is **never persisted on its own**. Tracing the existing flow:

- `meeting_recording_segments` holds *audio-derived* transcripts, one row per audio
  segment, written by `transcribeSegment` with `onConflictDoUpdate` on
  `(meetingId, index)`.
- The live transcript's only role today is as the `liveTranscriptHint` argument —
  passed into `transcribeSegment` (to help spell names/terms) and into
  `finalizeMeetingRecording(meetingId, liveTranscriptHint)`.

So this feature only has to produce *better text* into the same
`finalTranscriptRef.current` that the Web Speech path fills today. Nothing new is
stored, no column changes, **no migration**. Writing live text into
`meeting_recording_segments` was considered and rejected: its unique
`(meeting_id, index)` index is owned by the audio-segment upserts, and interleaving a
second producer would make the two fight over indices.

---

## 7. Implementation

All new files; nothing existing was modified.

| File | Role |
| --- | --- |
| `src/features/transcription/pcm.ts` | Float32 → 16 kHz → 16-bit PCM → base64 |
| `src/features/transcription/live-protocol.ts` | Setup/audio frames, server-event parsing |
| `src/features/transcription/transcript-buffer.ts` | Replay-tolerant fragment accumulation |
| `src/features/transcription/session-budget.ts` | Token/cost estimates, auto-stop rules |
| `src/features/transcription/flag.ts` | `NEXT_PUBLIC_GEMINI_LIVE_TRANSCRIPTION`, default off |
| `src/features/transcription/live-token.ts` | **Server-only** ephemeral-token minting |
| `src/features/transcription/actions.ts` | `requestLiveToken(meetingId)` server action |
| `src/features/transcription/live-client.ts` | Browser socket + audio state machine |
| `src/features/transcription/components/use-live-transcription.ts` | React binding |
| `src/features/transcription/components/live-transcription-status.tsx` | Honest status + cost notice |

Reuse rather than duplication:

- Retry/backoff comes from `@/features/gemini/retry` (`shouldRetry`, `backoffDelayMs`,
  `sleep`) — including the socket reconnect schedule.
- Errors are the existing `GeminiError` with its existing codes.
- Key rotation mirrors `callGemini`: active keys, `lastUsedAt ASC NULLS FIRST`,
  `failCount+1` on auth/quota failure, reset to 0 on success. There is no model-fallback
  pass, because a token pinned to a model the socket won't accept is worse than none.
- Authorization reuses `canManageMeeting` — the same gate as every other recording action.
- The code-switching instruction is carried over verbatim in framing from
  `ai-actions.ts` so live text and final minutes don't disagree about language.

Three decisions worth flagging:

1. **`ScriptProcessorNode`, not `AudioWorklet`.** A worklet needs a separate module
   file; a `blob:` worklet is the kind of thing a strict CSP blocks. ScriptProcessor is
   deprecated but works everywhere including iOS Safari, and mono 16 kHz is far too
   small for main-thread cost to matter.
2. **The session does not call `getUserMedia`.** It takes the recorder's existing
   `MediaStream`, so there is no second permission prompt and no second mic handle.
3. **`status === 'live'` requires a received transcript**, not just a connected socket.
   `listening` is a distinct, visible state meaning "connected, nothing heard yet".

### Runaway protection

- Hard cap 60 min, silence cap 5 min, enforced by a 1 s watchdog inside the session.
- The React hook stops the session on unmount, so an unmounted panel can't keep
  streaming.
- Tokens are single-use with a 2-minute window to open a session — a leaked token is
  near-worthless.

---

## 8. Integration points for `meeting-intel.tsx`

**I did not modify this file** (another agent has uncommitted work in it). Line numbers
are from the current `main` and are approximate.

```ts
import { isLiveTranscriptionEnabled } from '@/features/transcription/flag'
import { useLiveTranscription } from '@/features/transcription/components/use-live-transcription'
import {
  LiveTranscriptionStatus,
  LiveTranscriptionCostNotice,
} from '@/features/transcription/components/live-transcription-status'

const live = useLiveTranscription(meetingId)   // near the other hooks, ~line 235
```

| # | Where | Change |
| --- | --- | --- |
| 1 | `startRecording`, after `getUserMedia` (~**867**) and where `startBilingualRecognition()` is called (~**732**) | If `isLiveTranscriptionEnabled()`, call `await live.start(micStream)` **instead of** `startBilingualRecognition()`. Pass the mic stream, not the mixed screen-capture stream. |
| 2 | `finalText` / `interimText` state (**262-263**) | When live is active, render `live.finalText` / `live.interimText` instead of the Web Speech values. |
| 3 | `finalTranscriptRef` (**341**) | Keep it fed with `live.combinedText` — this is what reaches `uploadSegment` (**773**) as `liveTranscriptHint` and `finalizeMeetingRecording` (**831**). This single wire is what makes the whole feature pay off downstream. |
| 4 | Stop button (**1200**) and `recorder.onstop` (**927-941**) | Also call `live.stop()`. |
| 5 | Transcript panel (**1281-1300**), near `showLiveText` (**1151**) | Render `<LiveTranscriptionStatus status={live.status} notice={live.notice} elapsedMs={seconds * 1000} />`. |
| 6 | Before recording starts, near the Record buttons (**1171-1175**) | Render `<LiveTranscriptionCostNotice />` when the flag is on. |
| 7 | `live.notice !== null` | Fall back to `startBilingualRecognition()` and keep the notice on screen. Never clear it silently. |

The existing Web Speech path stays in place and remains the default; with the flag off,
nothing above executes.

---

## 9. Verification status

Run in this repo, on `main`:

- `npx tsc --noEmit` — **clean**.
- `npm test` — **505 passed / 43 files**, including **77 new tests** across
  `pcm`, `live-protocol`, `transcript-buffer`, `session-budget`, `flag`.
- `npx eslint src/features/transcription` — **clean**.

**Not verified, and cannot be by me:**

- **No real audio and no real speech.** There is no microphone in this environment. The
  PCM pipeline is verified against `Buffer` as an oracle and the protocol against the
  documented frame shapes, but nothing has transcribed an actual sentence.
- **No live socket was ever opened.** No Gemini key was used. Whether a free-tier key
  may call `auth_tokens` at all is the single biggest open risk (§5).
- **The exact setup-message field placement is unconfirmed.** Google's own docs show
  `responseModalities` and `inputAudioTranscription` in *two different places*
  (top-level `setup` in one example, nested under `generationConfig` in another). I
  followed the proto-accurate shape — `responseModalities` inside `generationConfig`,
  `inputAudioTranscription` top-level. If the first real handshake is rejected, this is
  the first thing to try flipping; it is isolated to `buildSetupMessage`.
- **Model id unconfirmed.** `gemini-3.1-flash-live-preview` comes from current docs
  examples; overridable via `NEXT_PUBLIC_GEMINI_LIVE_MODEL` without a code change.

## 10. Open items

- [ ] Confirm `auth_tokens` is permitted on a free-tier key (§5) — do this first.
- [ ] Confirm the setup-message field placement against a real handshake (§9).
- [ ] Verify with real Sinhala/English code-switched speech, on Chrome desktop and on
      iPhone Safari, before the flag is turned on for anyone.
