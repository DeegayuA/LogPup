'use server'

import { GeminiError, callGemini } from '@/features/gemini/client'
import { resolveChain } from '@/features/gemini/model-choice'
import { aiFeatureDisabledMessage, getAiPrefs } from '@/features/gemini/prefs'
import { loadActor } from '@/features/auth/actor'
import { can } from '@/features/auth/capabilities'
import { getSessionUser } from '@/lib/session'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { totalMinutes } from '@/features/worklog/entries'
import { findDiscrepancies, type Observation } from '@/features/worklog/entry-check'
import { applyPhrasing, buildEntryCheckPrompt } from '@/features/worklog/entry-check-prompt'
import {
  buildEntryDraftPrompt,
  parseDraftedEntries,
  type ProposedEntry,
} from '@/features/worklog/entry-draft-prompt'
import { commitPromptLines } from '@/features/github/commits'
import {
  getMyDayEntries,
  loadDayEvidence,
  loadDrafterContext,
  toCheckEvidence,
} from '@/features/worklog/entry-evidence'
import { isAdminRole, type UserRole } from '@/features/auth/capabilities'
import { WORK_DAY_PATTERN, isFutureWorkDay } from '@/features/worklog/worklog-day'

/**
 * The two AI features over per-task worklog hours: DRAFT on request, and
 * REVIEW at save.
 *
 * SELF ONLY, for both. Neither takes a `targetUserId` and neither must ever
 * grow one. There is deliberately no `worklog.write.any` for any of the seven
 * seats — capabilities.test.ts asserts the key does not exist — because a
 * worklog is a FIRST-PERSON STATEMENT about somebody's own day. An AI that
 * drafts, or worse audits, a day on somebody else's behalf turns that statement
 * into a report about them, which is the exact shape this feature refuses.
 *
 * NEITHER ACTION WRITES ANYTHING. The draft returns proposals for the person to
 * edit and save through `createWorklogEntry`; the check returns observations for
 * the person to read. Saving always succeeds and the check never blocks it.
 *
 * THE PERSON SEES IT FIRST. An observation goes back to the author of the
 * entries and nowhere else — no admin rollup, no manager surface. The
 * surveillance risk in this feature was never the data; it is who reads the
 * conclusion first, and an AI-flagged "your hours do not match your activity"
 * that a manager reads before the author does is an accusation they never had a
 * chance to answer.
 */

/**
 * May this person have LogPup touch their own worklog at all?
 *
 * The same two lines `writer()` in entry-actions.ts uses, and deliberately the
 * same capability: these features propose and comment on rows only that
 * person's own hands can save, so the seats that cannot write a worklog
 * (stakeholder, auditor) have no business generating one either. It is
 * restated rather than imported because entry-actions.ts is a `'use server'`
 * module and may only export async actions.
 */
async function writer() {
  const actor = await loadActor()
  if (!actor || !can(actor, 'worklog.write.own', { ownerId: actor.id })) return null
  // The name is for the prompt only — a draft is written in the FIRST PERSON as
  // this person, and a check is addressed to them. `Actor` deliberately carries
  // no name (it is a permissions object), and `getSession` is request-cached, so
  // asking here costs nothing the page has not already paid for.
  const user = await getSessionUser()
  return { id: actor.id, name: user?.name?.trim() || null }
}

// ---------------------------------------------------------------------------
// 1. Draft on request
// ---------------------------------------------------------------------------

/** A proposal, marked as one. */
export type DraftedEntry = ProposedEntry & { source: 'ai_suggested' }

export type WorklogEntriesDraft = {
  /**
   * Rows to show as editable suggestions. EVERY ONE carries
   * `source: 'ai_suggested'` so `createWorklogEntry` records how it arrived and
   * we can later measure how often a draft is accepted unedited — and so a UI
   * cannot present one as something the person typed.
   */
  entries: DraftedEntry[]
  /** What the person had already logged for the day; the draft is on top of it. */
  alreadyLoggedMinutes: number
  /**
   * How many recorded things the draft was judged from — meetings plus activity
   * rows. Travels back so the UI can caption the proposals ("from 6 recorded
   * things") and so an empty day reads as a quiet day rather than as the model
   * having failed.
   */
  evidenceCount: number
  /** The day's scheduled length, or null when it genuinely cannot be said. */
  scheduledMinutes: number | null
}

/**
 * Proposes how the day's hours went, for the person to correct before saving.
 *
 * NEVER SUBMITS ON THEIR BEHALF. It returns rows; `createWorklogEntry` is the
 * only path into the table and it runs when they press save.
 */
export async function draftWorklogEntries(
  day: string,
): Promise<ActionResult<WorklogEntriesDraft>> {
  const actor = await writer()
  if (!actor) return err('Not allowed')

  const disabled = await aiFeatureDisabledMessage(actor.id, 'worklog-entries-draft')
  if (disabled) return err(disabled)

  if (!WORK_DAY_PATTERN.test(day)) return err('That is not a day')
  const now = new Date()
  if (isFutureWorkDay(day, now)) return err('That day has not happened yet')

  const [evidence, existing, context] = await Promise.all([
    loadDayEvidence(actor.id, day, now),
    getMyDayEntries(actor.id, day),
    loadDrafterContext(actor.id, day),
  ])

  const alreadyLoggedMinutes = totalMinutes(existing)
  /*
   * COMMITS COUNT. They were gathered, passed to the prompt, and then left out
   * of this total — so a day spent writing code, with no meeting and no card
   * moved, came back "LogPup recorded nothing for that day" without ever
   * asking the model. That is the developer's ordinary day, and it was the one
   * day Fill-my-day refused to help with.
   */
  const evidenceCount =
    evidence.meetings.length + evidence.activity.length + evidence.commits.length
  const empty: WorklogEntriesDraft = {
    entries: [],
    alreadyLoggedMinutes,
    evidenceCount,
    scheduledMinutes: evidence.scheduledMinutes,
  }

  // NO EVIDENCE, NO CALL. In-progress tasks are deliberately not counted here:
  // they are a vocabulary of ids the model may name, not proof that anything
  // happened on this particular day. Drafting from them alone would be the
  // model inventing a day out of somebody's backlog — and it would cost a
  // request to do it.
  if (evidenceCount === 0) return ok(empty)

  const prompt = buildEntryDraftPrompt({
    name: actor.name ?? 'this engineer',
    // Who they are, what they are on, and what their days usually look like.
    // The evidence says what happened; this says whose day it was, which is
    // what makes a PM's draft read like a PM's day rather than an engineer's.
    person: {
      name: actor.name ?? 'this engineer',
      title: context.title,
      // The seat comes from the context read, not from `actor`: writer() hands
      // back only an id and a name, and widening it would put a permissions
      // object where a prompt input belongs.
      role: context.role,
      isAdmin: isAdminRole(context.role as UserRole),
    },
    projects: context.projects,
    recentDays: context.recentDays,
    day,
    scheduledMinutes: evidence.scheduledMinutes,
    onApprovedAbsence: evidence.onApprovedAbsence,
    alreadyLoggedMinutes,
    meetings: evidence.meetings,
    activity: evidence.activity,
    tasks: evidence.tasks,
    commits: commitPromptLines(evidence.commits),
  })

  try {
    const prefs = await getAiPrefs(actor.id)
    const { text } = await callGemini(actor.id, [{ text: prompt }], {
      models: resolveChain('worklog-entries-draft', prefs['worklog-entries-draft'].model),
      responseJson: true,
      feature: 'worklog.entries-draft',
    })

    // The id fence: the model may only name a task it was shown. A hallucinated
    // uuid would otherwise either break the foreign key at save time or, far
    // worse, land on a real task in somebody else's project.
    const allowed = new Set(evidence.tasks.map((task) => task.id))
    const entries = parseDraftedEntries(text, allowed)

    return ok({
      ...empty,
      entries: entries.map((entry) => ({ ...entry, source: 'ai_suggested' as const })),
    })
  } catch (error) {
    if (error instanceof GeminiError) return err(error.message)
    return err('Could not draft that right now — fill it in yourself or try again')
  }
}

// ---------------------------------------------------------------------------
// 2. Review at save
// ---------------------------------------------------------------------------

export type WorklogEntriesCheck = {
  /**
   * What the app noticed, in the order `findDiscrepancies` returned it. EMPTY
   * IS THE COMMON CASE and must render as nothing at all — a quiet check reads
   * as success, not as a check that failed to run.
   */
  observations: Observation[]
  /**
   * Whether a model reworded them. False means the computed sentences are being
   * shown, which is a normal outcome rather than a degraded one: they are real
   * product copy, written to stay grammatical at every value.
   */
  phrased: boolean
}

const SILENT: WorklogEntriesCheck = { observations: [], phrased: false }

/**
 * The cross-check that runs when a day's entries are saved.
 *
 * ============================================================================
 * THE PURE-FUNCTION COMMITMENT, ENFORCED HERE.
 * ============================================================================
 * `findDiscrepancies` — pure, no database, no model, no clock — decides what is
 * worth saying. This action's entire relationship with Gemini is to ask for
 * NICER WORDING of what that function already produced.
 *
 * Three properties hold, and each is a line of code below rather than a line of
 * the prompt:
 *
 *   1. ZERO OBSERVATIONS MEANS ZERO MODEL CALLS. The early return below fires
 *      before prefs are read, before a prompt is built, before a key is
 *      touched. Silence is the common case and it costs nothing — no request,
 *      no ledger row, no latency on the save.
 *   2. THE MODEL SEES ONLY THE OBSERVATIONS. Not the entries, not the meetings,
 *      not the activity log, not the schedule. It has nothing to reason from
 *      even if it were asked to.
 *   3. THE REPLY MAPS 1:1 OR IS DROPPED. `applyPhrasing` returns exactly the
 *      observations it was given — same length, order, kinds, severities and
 *      facts — with only wording possibly changed, and only where the rewrite
 *      introduced no number nobody computed and no accusatory word.
 *
 * Why the ceremony: an AI that invents a discrepancy about how somebody spent
 * their working day is worse than no check at all. The person was there and the
 * app was not.
 */
export async function checkWorklogEntries(
  day: string,
): Promise<ActionResult<WorklogEntriesCheck>> {
  const actor = await writer()
  if (!actor) return err('Not allowed')

  const disabled = await aiFeatureDisabledMessage(actor.id, 'worklog-entries-check')
  if (disabled) return err(disabled)

  if (!WORK_DAY_PATTERN.test(day)) return err('That is not a day')

  const entries = await getMyDayEntries(actor.id, day)
  // A day with nothing logged is an empty day, not a discrepancy — the
  // calendar's own 'Missing' state already says so plainly. `findDiscrepancies`
  // returns nothing for it, so the evidence read is skipped too.
  if (entries.length === 0) return ok(SILENT)

  const evidence = await loadDayEvidence(actor.id, day, new Date())
  const observations = findDiscrepancies(entries, toCheckEvidence(evidence))

  // ---- THE SHORT CIRCUIT. Do not move anything above this line below it. ----
  if (observations.length === 0) return ok(SILENT)

  const prompt = buildEntryCheckPrompt({
    name: actor.name ?? 'you',
    day,
    observations,
  })

  try {
    const prefs = await getAiPrefs(actor.id)
    const { text } = await callGemini(actor.id, [{ text: prompt }], {
      models: resolveChain('worklog-entries-check', prefs['worklog-entries-check'].model),
      responseJson: true,
      feature: 'worklog.entries-check',
    })
    return ok({ observations: applyPhrasing(observations, text), phrased: true })
  } catch {
    // A failed call costs the wording and NOTHING ELSE. Every observation
    // arrived with a sentence that is safe to show, so the check still says
    // what it found — swallowing it here would turn a phrasing outage into the
    // app quietly deciding not to mention something it noticed.
    return ok({ observations, phrased: false })
  }
}
