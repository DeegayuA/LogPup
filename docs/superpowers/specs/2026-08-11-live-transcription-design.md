# Live bilingual transcription — design

Date: 2026-08-11 · Scope: `meeting-intel.tsx`, `language-switch.ts`, `language-switch.test.ts`
Design system: `2026-08-11-ui-redesign-design.md` ("watchdog calm") — tokens only, no raw hex.

## The measurement that reframes everything

Before designing anything, the load-bearing assumption was tested: can one page run two
concurrent `SpeechRecognition` sessions? Probe: Google Chrome (HeadlessChrome/151, real
branded build, `--use-fake-device-for-media-stream`), two instances, staggered start,
every lifecycle event logged.

```
1ms     A[en-US].start() returned          <- no throw
16ms    A[en-US] start
1503ms  B[si-LK].start() returned          <- no throw
1503ms  A[en-US] end                       <- A killed in the same millisecond
2239ms  B[si-LK] audiostart                <- ~740ms to actually own the mic
4144ms  B[si-LK] result                    <- only B ever hears anything
```

Then the same probe with this component's own `onend` auto-restart wired to both engines:

```
after 8s: {"en-US":{"starts":16732,"ends":30098,"results":0,"audiostart":1},
           "si-LK":{"starts":16518,"ends":30097,"results":0,"audiostart":0}}
```

Findings, in order of consequence:

1. **Two concurrent sessions are impossible.** Chrome's speech manager arbitrates one
   session per browser process: starting the second *aborts* the first. Every target
   browser is affected — Chrome desktop, Edge desktop, Android Chrome are all Chromium;
   Safari arbitrates through one `SFSpeechRecognizer` too.
2. **`start()` never throws for this.** The existing resource guard in `startEngine`
   (`try { start() } catch { return false }`) can never fire — it only catches
   `InvalidStateError` from starting the *same* instance twice. So the component believed
   it was running dual mode while one engine was already dead.
3. **The auto-restart turns that into a spin loop.** A's `onend` restarts A, which kills
   B, whose `onend` restarts B, which kills A: ~30,000 session ends in under 7 seconds and
   **zero recognition results**. Not "degraded bilingual" — no live text at all.
4. The kill surfaces inconsistently: sometimes `error: aborted` then `end`, sometimes a
   bare `end`. Detection must key on `end`, not on the error.
5. `SpeechRecognition.available({ langs, processLocally: false })` exists in Chrome 151 but
   **cannot be trusted as a language check** — it answered `"available"` for the nonsense
   tag `zz-ZZ`. Only `processLocally: true` discriminates (`si-LK` → `"unavailable"`), and
   that answers a different question (on-device models). It is not used as a gate here.

### Why the reported symptoms follow from this

The user-visible bug ("phrase vanishes, reappears 1.2s later, every time") is the
downstream effect: one engine dies, `engineModeRef` still says `'dual'`, so every final
enters the pairing buffer and waits out the full `UTTERANCE_PAIR_WINDOW_MS` for a partner
that no longer exists. The buffered text renders nowhere. The pairing window became a flat
1.2s tax on every utterance.

## Direction

Live text is a **preview**; the authoritative bilingual record is the Gemini analysis of
the recorded audio, which is unaffected by any of this. So: never block, never delay, never
overstate. One engine at a time, said out loud.

Three rules the implementation is held to:

- **Nothing spoken is ever invisible.** Text appears the moment an engine produces it.
  Pairing may *replace* text; it may never *withhold* it.
- **The status line never lies.** It names the engine actually running. "Bilingual" is
  shown only while two engines are genuinely alive.
- **Failure is stated, not swallowed.** A language the browser can't hear gets a visible,
  specific notice — never silent garbage.

## Changes

### 1. Provisional rendering — the vanishing phrase (defect 1)

A buffered-but-unpaired final is now rendered immediately as provisional text, styled like
interim (`text-muted-foreground italic`, per the design system's muted-foreground token).
Render order is `final · provisional · interim`. When pairing resolves, the winner is
committed to `finalText` and the provisional clears **in the same React commit** — the text
is replaced in place, never removed and re-added. Perceived latency: zero.

While a provisional from engine L is pending, only L's interim is displayed. The other
engine's interim at that moment is a competing read of the *same* audio, and showing both
would print the phrase twice in two scripts. L's own interim still shows, because that is
genuinely new speech (L already finalized its read).

### 2. The pairing window (defect 2)

**Unchanged at 1200ms, deliberately.** Once display no longer waits on it, the window costs
no perceived latency — it buys pairing accuracy and its only remaining cost is that a
competing interim is hidden for at most that long. Shortening it would trade real accuracy
for an invisible gain. What actually fixes "every final delayed 1.2s" is not a smaller
number: it is (a) rendering the buffer, and (b) never sitting in dual mode with one engine.

### 3. Script-aware interim leader (defect 3)

The old rule compared UTF-16 lengths, which is biased: Sinhala is an abugida at ~1.9 code
units per syllable against English's ~3.0 including spaces, so the same speech yields a
systematically shorter Sinhala string and English wins the length race by construction.

The literal fix suggested — "si contains Sinhala codepoints and en does not, so si wins" —
was **not** implemented as stated, because it inverts the bias rather than removing it: an
`si-LK` recognizer emits Sinhala script for *whatever* it hears, including English speech,
so that predicate is true almost whenever the si engine has any text at all.

What is implemented is script-aware **normalization**: `estimateSpokenUnits` converts either
script to a comparable count of spoken syllables — Sinhala base letters (U+0D85–U+0DC6)
minus viramas (U+0DCA, which fuse a cluster into one syllable), plus vowel-group counting
for Latin, plus digit runs. Comparison then happens in the same unit for both engines.
`containsSinhala` (the U+0D80–U+0DFF check) is kept as its own pure primitive and earns its
place in the silent-fallback detector below, where the predicate really is diagnostic.

`pickInterimLeader` adds hysteresis: the incumbent leader keeps the display unless the
challenger is ahead by `INTERIM_LEADER_MARGIN` (25%). A live transcript that flips between
two scripts on every partial result is unreadable; stickiness is a feature.

### 4. Concurrency probe, and never claiming dual (defect 4)

Dual mode is no longer assumed — it is *proved* per browser, once, and the answer is
persisted (`logpup:transcribe-dual-unsupported`).

- Engine 1 starts. On its `audiostart` (proof it owns the mic) engine 2 starts, with a
  `probing` flag set.
- **While probing, neither engine auto-restarts.** This is what makes the probe safe: the
  30,000-restart storm requires both engines to blindly restart, and during the probe
  neither does.
- If engine 1 ends within `DUAL_PROBE_WINDOW_MS` (600ms — the observed kill lands in ~10ms;
  this is only an upper bound) it was killed by engine 2. Concurrency is unsupported:
  persist it, stop engine 2, restart engine 1 alone, drop to single-engine mode, notice
  shown. Subsequent recordings skip the probe entirely.
- `engineModeRef` is derived from how many engines are *alive*, never from intent. The
  moment only one engine remains, finals commit immediately — this is the actual cure for
  the 1.2s tax.
- Second line of defence: `isRestartStorm` (pure) trips if an engine restarts
  `RESTART_STORM_LIMIT` (6) times without ever reaching `audiostart`, and collapses to
  single-engine regardless of what the probe concluded.

Practical effect on every browser the team uses: single engine, honestly labelled, with the
bilingual record still produced by the Gemini pass.

### 5. Restart gap (defect 5)

`onend` still restarts synchronously — that gap (~500–740ms to `audiostart`, measured) is
browser-side and cannot be closed from JS; a second overlapping session is exactly what
gets aborted. Two things are fixed around it:

- The old `catch { /* the next onend will retry */ }` was unsound: if `start()` throws
  there is no session, so no further `onend` ever fires and the engine dies silently
  forever. Restart now retries on a timer (`RESTART_RETRY_MS`, up to a few attempts).
- Documented honestly in the UI: words spoken during a restart can be missed by the live
  preview; the recording itself is continuous and loses nothing.

### 6. Honest degradation for si-LK (browser reality)

- `language-not-supported` is now treated as a **permanent, language-specific** failure. It
  previously fell through to `onend`, which restarted a doomed engine forever.
- Silent locale fallback — a browser that accepts `lang = 'si-LK'` and quietly transcribes
  English anyway (the Safari-shaped risk) — is caught by `isSilentSinhalaFallback`: N finals
  from the si engine containing zero Sinhala codepoints.
- Either way the notice is specific and visible: *"Sinhala live text isn't available in this
  browser — the recording still captures it for the AI notes."* Never silent garbage, never
  a claim of bilingual.

### 7. Bug found while implementing: the last utterance was dropped

`recorder.onstop` read `finalTranscriptRef.current` and then called `cleanupCapture()`,
which discards `pendingUtteranceRef`. In dual mode the final utterance of *every* recording
— the buffered one — never reached the transcript sent to Gemini. Pending is now flushed
before the transcript is read.

## Pure logic (`language-switch.ts`, side-effect free by contract)

| export | purpose |
| --- | --- |
| `pickUtterance` / `shouldFlush` / `UTTERANCE_PAIR_WINDOW_MS` | unchanged; 13 existing cases stay green |
| `containsSinhala(text)` | U+0D80–U+0DFF presence |
| `estimateSpokenUnits(text)` | script-aware syllable estimate |
| `pickInterimLeader({ en, si, previousLang, currentLeader })` | which engine's partial to show |
| `isSilentSinhalaFallback({ finalsSeen, finalsWithSinhala })` | browser lied about si-LK |
| `isRestartStorm({ restartsWithoutAudio })` | engines killing each other |

All of it stays framework-free: the component owns every timer, recognizer and ref.

## UI (design system)

No new colour. Provisional and interim share `text-muted-foreground italic`. Notices are the
existing one-line `text-xs text-muted-foreground` treatment — non-blocking, never a toast,
because the meeting keeps recording regardless. The status chip reads the true engine:
`Bilingual · English` only while two engines live, otherwise plain `English` / `Sinhala`.

## Done means

`npx tsc --noEmit` clean · `npm test` green (13 existing cases untouched, new pure functions
covered) · no changes to `note-timeline.tsx`, `notes.ts`, `ai-actions.ts`.
