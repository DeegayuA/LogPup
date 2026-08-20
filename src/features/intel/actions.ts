'use server'

import { z } from 'zod'
import { getSession } from '@/lib/session'
import { err, ok, type ActionResult } from '@/lib/action-result'
import { GeminiError, callGemini, hasGeminiKeys } from '@/features/gemini/client'
import { isFeatureRouted, resolveChain } from '@/features/gemini/model-choice'
import { aiFeatureDisabledMessage, getAiPrefs } from '@/features/gemini/prefs'
import { deriveBriefing } from '@/features/intel/briefing-fallback'
import { loadWorkspaceSnapshot, type WorkspaceSnapshot } from '@/features/intel/context-pack'
import { isAiFeatureEnabled } from '@/features/gemini/prefs'
import {
  CITATIONS_HEADER,
  buildAskPrompt,
  buildBriefingPrompt,
  isInAppRoute,
} from '@/features/intel/prompt'
import { buildSignals, type Signal } from '@/features/intel/signals'

/**
 * /intel's three server actions.
 *
 * Only ONE of them spends a Gemini call unconditionally. That split is the
 * whole design: signals are rules over a snapshot and must work with AI
 * switched off and no key on the account; the briefing prefers AI but always
 * has a true answer to fall back on; only a direct question genuinely has
 * nothing to show when the model is unreachable, and that one reports the
 * failure instead of inventing a consolation prize.
 */

const askInput = z.object({
  question: z.string().trim().min(3).max(500),
})

/** A route the answer leaned on, as the client renders it. */
export type AskCitation = { label: string; href: string }

export type AskAnswer = {
  answer: string
  citations: AskCitation[]
  /**
   * Did the model cite the pack, or only read it?
   *
   * READ THIS BEFORE "FIXING" A FALSE WITH A NON-EMPTY `citations`. That
   * combination is not a bug, it is the entire point: when the model could
   * ground nothing, `citations` carries the rows the pack actually contained,
   * so the reader gets "I could not ground this — here is what I looked at"
   * with real links instead of a bare apology. Clearing the array on `false`
   * deletes the only useful half of that answer.
   *
   * The UI keys off THIS FLAG, never off `citations.length`. An empty array is
   * a condition somebody forgets to check; a discriminant is one the type
   * system asks about — and this action is reached from the command palette,
   * where a confident paragraph with no provenance is the most expensive
   * failure the feature has.
   */
  grounded: boolean
  model: string
}

export type Briefing = {
  headline: string
  body: string
  priorities: string[]
  /**
   * Where the words came from. `derived` is a real briefing built from the
   * same snapshot by pure rules — not a degraded placeholder — but the reader
   * is told which one they are looking at either way.
   */
  source: 'ai' | 'derived'
  model: string | null
  generatedAtIso: string
}

/** More than this and the answer is citing the whole workspace, not a source. */
const MAX_CITATIONS = 6

const briefingSchema = z.object({
  headline: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(4000),
  // .catch([]) rather than a hard failure: a briefing whose prose is fine and
  // whose priority list came back malformed is still worth reading, and the
  // whole result already has a derived fallback behind it.
  priorities: z.array(z.string().trim().min(1).max(300)).max(5).catch([]),
})

/**
 * Ask the workspace a question.
 *
 * Deliberately NOT silently degraded. getBriefing below answers a failure with
 * a derived summary because "here is your day" is answerable from the snapshot
 * alone — but a person who asked "who is over capacity on Alpha?" and got a
 * generic status paragraph would have been lied to about a direct question.
 * So the GeminiError message is passed through verbatim: it is the one place
 * that can say the key was rejected, the quota is spent, or every model is
 * busy.
 */
export async function askWorkspace(question: string): Promise<ActionResult<AskAnswer>> {
  // getSession, not auth(): loadWorkspaceSnapshot resolves an Actor through
  // loadActor, which asks getSession too. auth()'s jwt callback hits the
  // database on every call, so sharing the request-scoped read saves a round
  // trip on a path someone is waiting on.
  const session = await getSession()
  if (!session?.user) return err('Not signed in')
  const user = session.user

  const parsed = askInput.safeParse({ question })
  if (!parsed.success) {
    return err(
      parsed.error.issues[0].code === 'too_big'
        ? 'That question is too long — ask something shorter'
        : 'Ask a question first',
    )
  }

  const disabled = await aiFeatureDisabledMessage(user.id, 'workspace-ask')
  if (disabled) return err(disabled)

  const now = new Date()
  let snapshot: WorkspaceSnapshot
  try {
    snapshot = await loadWorkspaceSnapshot(user, now)
  } catch (error) {
    console.error('[intel] askWorkspace snapshot failed:', error)
    return err('Could not read your workspace right now — try again')
  }

  const prompt = buildAskPrompt({
    askerName: user.name ?? user.email,
    todayIso: snapshot.signalInput.todayIso,
    grounding: snapshot.grounding,
    question: parsed.data.question,
  })

  // Asked BEFORE the call, not caught after it. defaultChainFor throws for a
  // feature missing from DEFAULT_CHAIN, and that throw would otherwise land in
  // the catch below and render as "Could not answer that — try again" — advice
  // that can never work. The person asked a perfectly good question; they would
  // rephrase it forever against a missing map entry and conclude the feature is
  // bad at its job rather than absent. A wiring gap is not a failed question.
  if (!isFeatureRouted('workspace-ask')) {
    return err('Ask is not wired to a model yet — this is a setup gap, not your question')
  }

  try {
    const prefs = await getAiPrefs(user.id)
    const { text, model } = await callGemini(user.id, [{ text: prompt }], {
      models: resolveChain('workspace-ask', prefs['workspace-ask'].model),
      feature: 'workspace.ask',
    })
    const { answer, citations } = splitAnswer(text)
    if (!answer) return err('No answer came back — try asking again')
    // Ungrounded answers keep their provenance: the rows the pack carried are
    // handed back as citations so the reader can check the model's homework
    // even when the model declined to show it.
    if (citations.length === 0) {
      return ok({ answer, citations: snapshot.sources, grounded: false, model })
    }
    return ok({ answer, citations, grounded: true, model })
  } catch (error) {
    if (error instanceof GeminiError) return err(error.message)
    return err('Could not answer that — try again')
  }
}

/**
 * Can this person ask anything right now?
 *
 * ONE exported question, because the command palette offers an "Ask about
 * '<query>'" row on a missed search and that row must be wrong in exactly the
 * cases the action is. Two conditions checked at the call site would drift
 * apart the moment either side gains a third — a workspace-level AI switch,
 * an exhausted quota, a paid-tier requirement. Every future gate on
 * askWorkspace belongs INSIDE here, never beside it.
 *
 * Not a permission check: askWorkspace re-gates on every call. This exists so
 * the app's most-used surface does not advertise a dead end.
 *
 * The subject is the SESSION, never a parameter. Every export of a 'use
 * server' module is a public HTTP endpoint, so a `userId` argument here would
 * answer "does this person have AI switched on, and do they hold a Gemini
 * key?" for anyone who can guess an id — a question with no caller that needs
 * it and an answer nobody outside that account is owed.
 */
export async function askAvailable(): Promise<boolean> {
  const session = await getSession()
  if (!session?.user) return false
  if (!isFeatureRouted('workspace-ask')) return false
  const [enabled, keyed] = await Promise.all([
    isAiFeatureEnabled(session.user.id, 'workspace-ask'),
    hasGeminiKeys(session.user.id),
  ])
  return enabled && keyed
}

/**
 * Today's briefing.
 *
 * EVERY failure below the auth check ends in a derived briefing, not an error:
 * AI switched off, no Gemini key, a rejected key, every model busy, a reply
 * that was not the JSON it was asked for. deriveBriefing reads the same
 * snapshot the AI would have read, so the fallback is true — and showing an
 * error card where a true summary exists teaches people that the page is
 * broken when it is merely unassisted.
 *
 * The one exception is a snapshot that could not be read at all. There is
 * nothing to derive from then, and claiming a quiet workspace because the
 * database was unreachable would be the worst possible answer.
 */
export async function getBriefing(): Promise<ActionResult<Briefing>> {
  const session = await getSession()
  if (!session?.user) return err('Not signed in')
  const user = session.user

  const disabled = await aiFeatureDisabledMessage(user.id, 'daily-briefing')

  const now = new Date()
  let snapshot: WorkspaceSnapshot
  let signals: Signal[]
  try {
    snapshot = await loadWorkspaceSnapshot(user, now)
    signals = buildSignals(snapshot.signalInput)
  } catch (error) {
    console.error('[intel] briefing snapshot failed:', error)
    return err('Could not read your workspace right now — try again')
  }

  const derived = (): Briefing => ({
    ...deriveBriefing(snapshot.signalInput, signals),
    // Pinned at the call site rather than trusted from the pure builder: a
    // briefing that came out of deriveBriefing is derived, and mislabelling it
    // 'ai' would put a model name on words no model wrote.
    source: 'derived',
    model: null,
    generatedAtIso: now.toISOString(),
  })

  if (disabled) return ok(derived())

  try {
    const prefs = await getAiPrefs(user.id)
    const { text, model } = await callGemini(user.id, [{ text: buildBriefingPrompt({
      forName: user.name ?? user.email,
      todayIso: snapshot.signalInput.todayIso,
      grounding: snapshot.grounding,
    }) }], {
      models: resolveChain('daily-briefing', prefs['daily-briefing'].model),
      // The only JSON-mode surface callGemini exposes. A pinned model that
      // rejects JSON mode answers 400, which client.ts refuses to fall through
      // — which is exactly why this path lands on the derived briefing rather
      // than on a raw upstream error.
      responseJson: true,
      feature: 'workspace.briefing',
    })
    const written = parseBriefing(text)
    if (!written) return ok(derived())
    return ok({ ...written, source: 'ai', model, generatedAtIso: now.toISOString() })
  } catch (error) {
    if (!(error instanceof GeminiError)) {
      console.error('[intel] briefing generation failed:', error)
    }
    return ok(derived())
  }
}

/**
 * The signal list. NO AI CALL, ever — buildSignals is pure rules over the same
 * snapshot, so this surface keeps working for an account with AI switched off
 * and no Gemini key at all. That is the point: the alerts are the product, the
 * prose is the assist.
 */
export async function getSignals(): Promise<ActionResult<Signal[]>> {
  const session = await getSession()
  if (!session?.user) return err('Not signed in')

  try {
    const snapshot = await loadWorkspaceSnapshot(session.user, new Date())
    return ok(buildSignals(snapshot.signalInput))
  } catch (error) {
    console.error('[intel] signals failed:', error)
    return err('Could not read your workspace right now — try again')
  }
}

/**
 * Split the reply into prose and its trailing citation block.
 *
 * Defensive by construction: a model that forgot the block, wrote it empty,
 * spelled a row without the separator, or cited an absolute URL yields fewer
 * citations — never a throw, and never a link that leaves the product. The
 * answer text is what matters; the citations are an affordance on top of it.
 */
function splitAnswer(text: string): { answer: string; citations: AskCitation[] } {
  const marker = text.lastIndexOf(CITATIONS_HEADER)
  if (marker === -1) return { answer: text.trim(), citations: [] }

  const citations: AskCitation[] = []
  const seen = new Set<string>()
  for (const raw of text.slice(marker + CITATIONS_HEADER.length).split('\n')) {
    if (citations.length >= MAX_CITATIONS) break
    const row = raw.replace(/^\s*[-*•]\s*/, '').trim()
    if (!row) continue
    const separator = row.lastIndexOf('|')
    if (separator === -1) continue
    const label = row.slice(0, separator).trim()
    // The prompt asks for a bare route; the brackets are stripped anyway
    // because the rules block shows routes bracketed and models copy the shape.
    const href = row.slice(separator + 1).trim().replace(/^\[/, '').replace(/\]$/, '')
    // Shape-checked, not first-character-checked — see isInAppRoute. A model
    // reading planted task titles can spell '/\evil.com', which every browser
    // resolves off-site.
    if (!label || !isInAppRoute(href)) continue
    if (seen.has(href)) continue
    seen.add(href)
    citations.push({ label, href })
  }

  return { answer: text.slice(0, marker).trim(), citations }
}

/** JSON.parse in its own try: a non-JSON reply is a malformed answer, not a
 *  Gemini outage, and the two must not be reported as the same thing. */
function parseBriefing(text: string): z.infer<typeof briefingSchema> | null {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  const parsed = briefingSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}
