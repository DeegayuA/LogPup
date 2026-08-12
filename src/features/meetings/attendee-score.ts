/**
 * The attendee-recommender scoring ledger (A1-4) — the heart of the feature.
 *
 * Pure module: no `new Date()`, no I/O, no DB imports. Every date-sensitive
 * calculation is relative to `ScoreContext.today` / `ScoreContext.meetingDay`,
 * both injected by the caller (see spec "PURITY").
 *
 * THE INVARIANT THAT MATTERS MOST: no signal may ever subtract. There are no
 * negative terms anywhere in this model — every family below either adds a
 * non-negative number of points or contributes exactly 0 with a caveat, never
 * a penalty. `tierAll`'s abstain-mode path and every floor in `scoreCandidate`
 * only ever RAISE a candidate's minimum tier, never lower it. This is what
 * `attendee-score.test.ts`'s "removing evidence never raises tier" property
 * test is checking, and it is checked hardest in review.
 *
 * ARCHITECTURE: `scoreCandidate` computes ONE candidate's full ledger in
 * isolation — every family (E1..E7, A1), every R5/R6/R7/R8 floor/override/
 * ceiling from the spec's "Tiering" section EXCEPT the two rules that
 * genuinely need to see the whole candidate pool (ABSTAIN's <2-hard-evidence
 * gate, and R10's soft cap) — those live in `tierAll`, which receives the
 * already-scored array and reconciles the pool-level rules on top. AI
 * override (R9) is deliberately NOT applied here — that is Task 5's
 * `gemini-validator.ts`, which takes `ScoredCandidate.tier` as its baseline
 * and may promote it upward with cited evidence; this module's `tier` is
 * "what the deterministic rules alone say", which is exactly what the spec's
 * bounding property requires ("the row always answers 'what would the rules
 * alone have said?'").
 */

import { differenceInCalendarDays } from 'date-fns'
import { matchAgendaTopic } from '@/lib/agenda-topics'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type Tier = 'required' | 'optional' | 'skip'

export type ReasonCode =
  | 'followup_pinned'
  | 'followup_open'
  | 'followup_answered_here'
  | 'followup_redacted'
  | 'task_open'
  | 'task_sprint'
  | 'role_topic'
  | 'discussed'
  | 'spoke'
  | 'lead'
  | 'allocated'
  | 'lead_role_heuristic'
  | 'attended'
  | 'previous_occurrence'
  | 'already_invited'
  | 'agenda_match'
  | 'organizer'
  | 'opted_in'
  | 'conflict'

export type CaveatCode =
  | 'inferred_app'
  | 'ai_unavailable'
  | 'thin_evidence'
  | 'no_series'
  | 'new_person'
  | 'speaker_unresolved'
  | 'returner'

export type Reason = {
  code: ReasonCode
  points: number
  evidence: { ids: string[] }
  en: string
  si: string
}

export type Caveat = {
  code: CaveatCode
  en: string
  si: string
}

export type ScoredCandidate = {
  userId: string
  scoreDet: number
  scoreTotal: number
  hardEvidenceCount: number
  tier: Tier
  reasons: Reason[]
  caveats: Caveat[]
}

export type RecommendationRun = {
  /** True when fewer than 2 distinct candidates in this pool carry >=1 hard-evidence
   *  item — the modal, first-class "honest day-one" path (see spec "Tiering"). */
  abstained: boolean
  /** Final scored candidates. In abstain mode, `tier` has been replaced per the
   *  abstain rules (organizer/pinned required, app-assigned optional, else skip);
   *  scoreDet/scoreTotal/reasons/caveats are left exactly as `scoreCandidate` computed
   *  them, so the row still answers "what would the rules alone have said?". */
  scored: ScoredCandidate[]
  requiredCount: number
  /** R10 soft cap: more than 8 required is a private warning to the organizer, never
   *  an automatic demotion. */
  requiredOverflow: boolean
}

/**
 * Which of the four attendee-recommender surfaces this run is for. Mirrors
 * `MeetingAttendeeRecommendationSurface` in schema.ts (kept as a local
 * string union rather than importing the DB-facing type — this module has
 * no DB imports at all, see the file header).
 */
export type Surface = 'schedule' | 'pre' | 'retro' | 'series'

export type ScoreContext = {
  /** "Now" — used ONLY for the new-person floor (how long ago this candidate
   *  joined/was assigned, an absolute fact about them independent of which
   *  meeting is being scored). Injected; this module never calls `new Date()`. */
  today: Date
  /** The day of the meeting being scored. Every evidence-recency calculation
   *  (E1/E4/E5) and the series-regular/previous-occurrence checks are relative
   *  to THIS date, not `today` — so a retrospective run scored months later
   *  still reconstructs "how fresh was this evidence AT THE TIME" honestly,
   *  and a scheduling run scores freshness relative to when the meeting will
   *  actually happen. */
  meetingDay: Date
  surface: Surface
  meetingTitle: string
  meetingAgenda: string | null
  /** null = no app on the meeting and none could be inferred (APP-LESS MODE):
   *  E2/E3/E6 are hard-zeroed regardless of populated facts, and the R8
   *  ceiling applies. */
  appId: string | null
  /** True when `appId` was INFERRED rather than directly set on the meeting —
   *  applies the spec's x0.6 confidence multiplier to E2/E3/E6 and adds the
   *  `inferred_app` caveat. Ignored when `appId` is null (that is app-less
   *  mode, a stronger and different state than a low-confidence inference). */
  appIdInferred?: boolean
  /** Display name of `appId`'s app, for reason/caveat text ("Assigned to
   *  Vela at 60%."). Null when `appId` is null. */
  appName: string | null
  /** apps.techTags for `appId` — the E3 tech-tag-only fallback. Empty when
   *  `appId` is null. */
  appTechTags: string[]
  /** Distinct candidate pool size for THIS run. Pool <= 4 disables `skip`
   *  entirely (spec "TINY TEAM"). */
  poolSize: number
  /** The inferred series' display title, for caveat text — null when no
   *  series could be inferred (attendee-series.ts's seriesKey returned null,
   *  or there is no history at all). */
  seriesTitle: string | null
  /** How many prior occurrences of the series exist within the lookback
   *  window. A series is "established" at >= 2 (spec "Series rule"); below
   *  that E4/E5/E7 are unavailable and a `no_series` caveat is shown. */
  seriesOccurrenceCount: number
  /** True when the Gemini pass genuinely did not run this whole meeting (no
   *  key, quota, GeminiError, timeout) — NOT the same as "agenda too short to
   *  bother calling", which simply leaves `CandidateFacts.aiRelevance` null
   *  with no caveat. When true, `aiRelevance` is ignored even if populated. */
  aiUnavailable: boolean
}

// --- CandidateFacts ----------------------------------------------------------
//
// A plain data shape — no drizzle types, no DB imports (Task 6's DB gatherer
// produces this). Every field maps to exactly one spec source, listed in each
// comment below, so the gatherer has an unambiguous target to fill.

export type FollowupEvidenceItem = {
  id: string
  /** meeting_followups.createdBy IS NOT NULL. */
  humanAdded: boolean
  /** meeting_followups.kind. */
  kind: 'question' | 'action'
  sourceMeetingTitle: string
  /** The item's SOURCE meeting's startsAt (meeting_followups.sourceMeetingId -> meetings.startsAt). */
  sourceMeetingStartsAt: Date
  /** 'resolved' = meeting_followups.userId already resolves to this candidate.
   *  'orphan' = userId IS NULL, but the caller re-resolved personName to this
   *  candidate via matchPersonToAttendee (followups.ts) — read-only, never
   *  written back. Only include an orphan item here when the match was
   *  UNAMBIGUOUS; scored at 0.5x either way, but only counts as hard evidence
   *  when `humanAdded` is also true (spec E1 "Orphan recovery"). */
  attribution: 'resolved' | 'orphan'
  /** RETROSPECTIVE ONLY: meeting_followups.resolvedInMeetingId === the meeting
   *  being scored. Applies the x1.25 "answered in the room" multiplier. */
  resolvedInThisMeeting: boolean
  /** meeting_followups.text, for reason citation. */
  text: string
}

export type PinnedFollowupEvidence = {
  id: string
  /** meeting_followups.text. */
  text: string
  /** Display name of meeting_followups.createdBy (or userId, for a self-pin). */
  pinnedByName: string
  /** meeting_followups.createdAt. */
  pinnedOnDate: Date
}

export type OpenTaskEvidence = {
  id: string
  /** tasks.status === 'in_progress' (this item is only ever included when
   *  status is 'todo' or 'in_progress' — a "done" task is never an "open task"). */
  inProgress: boolean
}

export type RunningSprintEvidence = {
  /** sprints.name. */
  name: string
  /** sprints.endDate. */
  endDate: Date
  /** How many of THIS candidate's open tasks (from `openTasks`) sit in the
   *  running sprint — >=1 triggers the flat +4 bonus (never per-task). */
  openTaskCount: number
}

export type DiscussionEvidence = {
  meetingId: string
  meetingTitle: string
  meetingStartsAt: Date
  /** Count of meeting_ai_notes.perPerson[].points entries attributed to this
   *  candidate in that meeting (via matchPersonToAttendee — never SQL name
   *  equality). Raw count; the per-meeting cap of 3 is applied by the scorer. */
  points: number
}

export type VoiceMeetingEvidence = {
  meetingId: string
  meetingTitle: string
  meetingStartsAt: Date
  /** This candidate's own resolved speaking turns in this meeting. */
  candidateTurns: number
  /** Total turns ACROSS ALL speakers who resolved to a real user in this
   *  meeting (never the denominator of unresolved "Speaker N" turns). */
  resolvedTurnsTotal: number
  /** Count of DISTINCT resolved speakers in this meeting. */
  resolvedSpeakerCount: number
}

export type AttendanceEvidence = {
  /** Prior occurrences of the series within the lookback window (<=6, within 180d). */
  occurrences: number
  /** How many of those occurrences this candidate attended (response='going'). */
  attended: number
}

export type AiRelevanceEvidence = {
  /** Already validated by Task 5's gemini-validator.ts — 0, 5, or 10 (score 0|1|2 x 5). */
  points: number
  /** Verbatim >=12-char substring of meetings.agenda, already validated. */
  agendaQuote: string
  /** Verbatim substring of this candidate's own packet, already validated. */
  evidenceQuote: string
  /** The task/follow-up id the evidence quote was drawn from, or null when
   *  the anchor is the candidate's role string. */
  evidenceId: string | null
}

export type CandidateFacts = {
  userId: string
  /** [users.title, assignments.role for the meeting's app] — free text,
   *  filtered to non-empty entries by the caller. */
  roleTokens: string[]
  /** meeting.createdBy === this candidate. */
  isOrganizer: boolean

  /** This candidate's own open meeting_followups (already attributed to them
   *  — see FollowupEvidenceItem.attribution). Surface-appropriate filtering
   *  (plain 'open' vs retro's "open OR resolvedAt > meeting.startsAt"
   *  reconstruction) is the caller's job; every item here is "counts as open
   *  for this scoring run". */
  followups: FollowupEvidenceItem[]
  /** meeting_followups with targetMeetingId === the meeting being scored,
   *  status='open', attributed to this candidate. Almost always empty. */
  pinnedFollowups: PinnedFollowupEvidence[]

  /** This candidate's open (todo/in_progress) tasks.assigneeId rows on the
   *  meeting's app. Empty (never populated) when the meeting has no app. */
  openTasks: OpenTaskEvidence[]
  runningSprint: RunningSprintEvidence | null

  /** meeting_ai_notes.perPerson entries attributed to this candidate across
   *  series meetings within 180 days. Entries with no name, or a name
   *  matching /^speaker \d+$/i, are excluded by the caller. */
  discussionMeetings: DiscussionEvidence[]
  /** Past series meetings where THIS candidate specifically had a resolved
   *  speaker mapping (meeting_speakers or a segment carrying their
   *  speakerId). A meeting this candidate could not be resolved in is simply
   *  ABSENT from this array — see `unresolvedVoiceMeetingsCount`. */
  voiceMeetings: VoiceMeetingEvidence[]
  /** How many of this candidate's own series recordings had NO resolvable
   *  speaker mapping for them (unmapped "Speaker N", or no recording at
   *  all is NOT counted here — only "a recording exists but this candidate
   *  couldn't be attributed in it"). Feeds the `speaker_unresolved` caveat;
   *  never turns into a penalty. */
  unresolvedVoiceMeetingsCount: number

  /** apps.leadId === this candidate. */
  isLead: boolean
  /** This candidate's assignments row on the meeting's app, or null when
   *  they are not on it. */
  assignment: { allocationPct: number } | null
  /** apps.leadId IS NULL AND this candidate's assignments.role is in the
   *  small leadership allowlist (Tech Lead, Engineering Manager, ...) drawn
   *  verbatim from JOB_ROLE_GROUPS. Never set when `isLead` is true. Scores
   *  +3, tagged heuristic — deliberately does NOT floor the tier. */
  leadAllowlistRoleHeuristic: boolean

  /** meeting_attendees history over the inferred series (last 6 occurrences,
   *  180d window). Null when fewer than 2 prior occurrences exist (family
   *  UNAVAILABLE, not zero-as-judgement). */
  attendance: AttendanceEvidence | null
  /** meeting_attendees row on the immediately previous occurrence of this
   *  series. A floor (R5), independent of the ratio-based `attendance` above. */
  attendedPreviousOccurrence: boolean
  /** The previous occurrence's date, for reason text. Null when
   *  `attendedPreviousOccurrence` is false, or the date is unknown. */
  previousOccurrenceDate: Date | null

  /** A1 — already validated by Task 5's gemini-validator.ts. Null when the
   *  AI pass simply had nothing to say about this candidate (score 0 is
   *  still a valid non-null value); see `ScoreContext.aiUnavailable` for
   *  "the AI pass didn't run this meeting at all". */
  aiRelevance: AiRelevanceEvidence | null

  /** meeting_attendees row already exists for this candidate on this meeting
   *  (pre-meeting/retro surfaces only — no meetings row exists yet on the
   *  stateless scheduling surface). A floor (R5). */
  existingAttendeeRow: boolean
  /** "Ask to be included" — a person-controlled floor that outranks the
   *  model (R5), frozen once set. */
  selfOptIn: boolean
  /** The later of users.createdAt and this candidate's (userId, appId)
   *  assignment creation — null when unknown/not applicable. Used only for
   *  the <21-day new-person floor, measured against `ScoreContext.today`. */
  candidateJoinedAt: Date | null
  /** RETURNER GUARD: true when this candidate had zero attendance/task/
   *  segment activity across a contiguous >=21-day stretch inside the
   *  lookback window and has just reappeared — floors optional for one full
   *  series cycle (spec R5). The contiguous-gap detection itself is the
   *  caller's job; this module only applies the floor + caveat. */
  isReturner: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FAMILY_CAPS = {
  E1: 30,
  E2_NORMAL: 20,
  E2_RETRO: 10,
  E3: 14,
  E4: 10,
  E5: 8,
  E6: 12,
  A1: 10,
} as const

const REQUIRED_MIN_SCORE_DET = 30
const OPTIONAL_MIN_SCORE_TOTAL = 12
const NEW_PERSON_DAYS = 21

const TIER_RANK: Record<Tier, number> = { skip: 0, optional: 1, required: 2 }

function maxTier(a: Tier, b: Tier): Tier {
  return TIER_RANK[a] >= TIER_RANK[b] ? a : b
}

// ---------------------------------------------------------------------------
// Reason & caveat templates
//
// Static `{placeholder}` strings, not functions — the lint test
// (attendee-score.test.ts) scans these RAW STRINGS for a NUMBER, PROPER NOUN,
// or DATE placeholder and for banned vague/confidence phrases, exactly as
// house style already does for TOPIC_BUCKETS (agenda-topics.ts). Sinhala
// strings are draft translations in the same spirit as
// meetingAiNotes.terms's model-generated glossary explanations elsewhere in
// this codebase — fit for shipping, worth a native-speaker pass later.
// ---------------------------------------------------------------------------

export type ReasonTemplate = { code: ReasonCode; en: string; si: string }
export type CaveatTemplate = { code: CaveatCode; en: string; si: string }

export const REASON_TEMPLATES: ReasonTemplate[] = [
  {
    code: 'followup_pinned',
    en: "Pinned to this meeting: '{itemText}' — added by {pinnedByName} on {pinnedDate}.",
    si: "මෙම රැස්වීමට සම්බන්ධ කර ඇත: '{itemText}' — {pinnedByName} විසින් {pinnedDate} දින එකතු කරන ලදී.",
  },
  {
    code: 'followup_open',
    en: 'Owes {count} open item(s) from {sourceTitle} ({sourceDate}): {items}.',
    si: '{sourceTitle} ({sourceDate}) රැස්වීමෙන් විවෘත කාරණා {count}ක් ඉතිරිව ඇත: {items}.',
  },
  {
    code: 'followup_answered_here',
    en: 'Answered {count} open item(s) in this meeting.',
    si: 'මෙම රැස්වීමේදී විවෘත කාරණා {count}ක් විසඳන ලදී.',
  },
  {
    code: 'followup_redacted',
    en: "{count} open item(s) from meetings you can't see.",
    si: 'ඔබට නොපෙනෙන රැස්වීම්වලින් විවෘත කාරණා {count}ක්.',
  },
  {
    code: 'task_open',
    en: 'Owns {openCount} open task(s) in {appName}, {inProgressCount} in progress.',
    si: '{appName} හි විවෘත කාර්යයන් {openCount}ක් හිමිය, {inProgressCount}ක් ප්‍රගතියේ.',
  },
  {
    code: 'task_sprint',
    en: '{count} of their open {appName} task(s) are in {sprintName} (ends {sprintEndDate}).',
    si: 'ඔවුන්ගේ විවෘත {appName} කාර්යයන්ගෙන් {count}ක් {sprintName} හි ඇත (අවසන් වන්නේ {sprintEndDate}).',
  },
  {
    code: 'role_topic',
    en: "Agenda says '{quote}'; their role is {role}.",
    si: "න්‍යාය පත්‍රයේ සඳහන් වන්නේ '{quote}'; ඔවුන්ගේ භූමිකාව {role} වේ.",
  },
  {
    code: 'discussed',
    en: 'Named in the AI notes of {count} past {seriesTitle} meeting(s) ({points} discussion point(s)).',
    si: 'අතීත {seriesTitle} රැස්වීම් {count}ක AI සටහන්වල නම් සඳහන් වේ (සාකච්ඡා ලකුණු {points}ක්).',
  },
  {
    code: 'spoke',
    en: 'Took {candidateTurns} of {totalTurns} attributed speaking turns across the last {meetingCount} recorded {seriesTitle} meeting(s).',
    si: 'පසුගිය {seriesTitle} රැස්වීම් {meetingCount}ක ශබ්ද පටිගත කිරීම්වල, ආරෝපිත කථන වාරවලින් {totalTurns}න් {candidateTurns}ක් ගත්තා.',
  },
  {
    code: 'lead',
    en: 'Lead of {appName}.',
    si: '{appName} හි ප්‍රධානියා.',
  },
  {
    code: 'allocated',
    en: 'Assigned to {appName} at {pct}%.',
    si: '{appName} වෙත {pct}% ක් වෙන් කර ඇත.',
  },
  {
    code: 'lead_role_heuristic',
    en: "Their role, {role}, is on {appName}'s leadership allowlist.",
    si: 'ඔවුන්ගේ භූමිකාව, {role}, {appName} හි නායකත්ව ලැයිස්තුවේ ඇත.',
  },
  {
    code: 'attended',
    en: 'Attended {attended} of the last {occurrences} {seriesTitle} meetings.',
    si: 'පසුගිය {seriesTitle} රැස්වීම් {occurrences}න් {attended}කට සහභාගී විය.',
  },
  {
    code: 'previous_occurrence',
    en: 'Attended the previous occurrence of {seriesTitle}, on {date}.',
    si: '{seriesTitle} හි පෙර අවස්ථාවට, {date} දින සහභාගී විය.',
  },
  {
    code: 'already_invited',
    en: 'Already on the invite list for {meetingTitle}.',
    si: '{meetingTitle} සඳහා ආරාධිත ලැයිස්තුවේ දැනටමත් සිටී.',
  },
  {
    code: 'agenda_match',
    en: "Agenda line '{agendaQuote}' matches their open item '{evidenceQuote}'.",
    si: "න්‍යාය පත්‍ර පේළිය '{agendaQuote}' ඔවුන්ගේ '{evidenceQuote}' සමඟ ගැලපේ.",
  },
  {
    code: 'organizer',
    en: 'Organizer of {meetingTitle}.',
    si: '{meetingTitle} හි සංවිධායක.',
  },
  {
    code: 'opted_in',
    en: 'Asked to be included in {seriesTitle}.',
    si: '{seriesTitle} හි ඇතුළත් කිරීමට ඉල්ලා ඇත.',
  },
  {
    code: 'conflict',
    en: "Already on '{otherMeetingTitle}', {startTime}-{endTime}.",
    si: "දැනටමත් '{otherMeetingTitle}', {startTime}-{endTime} හි ඇත.",
  },
]

export const CAVEAT_TEMPLATES: CaveatTemplate[] = [
  {
    code: 'inferred_app',
    en: '{appName} was inferred from prior occurrences of this series — not set on the meeting itself.',
    si: '{appName} මෙම මාලාවේ පෙර අවස්ථා වලින් අනුමාන කරන ලදී — රැස්වීම මතම සකසා නැත.',
  },
  {
    code: 'ai_unavailable',
    en: 'AI relevance scoring was unavailable for this run — the deterministic score is unaffected.',
    si: 'මෙම ධාවනය සඳහා AI අදාළත්ව ලකුණු ලබාගත නොහැකි විය — නිශ්චිත ලකුණු බලපෑමට ලක් නොවේ.',
  },
  {
    code: 'thin_evidence',
    en: 'LogPup does not have enough agenda or title text to match roles for this meeting.',
    si: 'මෙම රැස්වීම සඳහා භූමිකා ගැලපීමට ප්‍රමාණවත් න්‍යාය පත්‍ර හෝ මාතෘකා පෙළක් LogPup සතුව නැත.',
  },
  {
    code: 'no_series',
    en: "Only {count} earlier '{seriesTitle}' — series signals unavailable.",
    si: "'{seriesTitle}' පෙර අවස්ථා {count}ක් පමණි — මාලා සංඥා නොමැත.",
  },
  {
    code: 'new_person',
    en: 'Joined {appName} {days} day(s) ago — history signals unavailable.',
    si: '{appName} වෙත එකතු වූයේ දින {days}කට පෙරය — ඉතිහාස සංඥා නොමැත.',
  },
  {
    code: 'speaker_unresolved',
    en: '{unresolved} of {total} recording(s) have unassigned speakers — participation not counted.',
    si: 'පටිගත කිරීම් {total}න් {unresolved}ක හඳුනා නොගත් කථිකයන් සිටී — සහභාගිත්වය ගණන් කර නැත.',
  },
  {
    code: 'returner',
    en: 'Returning to {appName} after a break in activity — recent history is not yet counted.',
    si: 'ක්‍රියාකාරකම් විරාමයකින් පසු {appName} වෙත නැවත පැමිණේ — මෑත ඉතිහාසය තවම ගණන් කර නැත.',
  },
]

const reasonTemplateByCode = new Map(REASON_TEMPLATES.map((t) => [t.code, t]))
const caveatTemplateByCode = new Map(CAVEAT_TEMPLATES.map((t) => [t.code, t]))

function interpolate(template: string, params: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = params[key]
    return value === undefined || value === null ? '' : String(value)
  })
}

function renderReason(code: ReasonCode, points: number, evidence: { ids: string[] }, params: Record<string, unknown>): Reason {
  const template = reasonTemplateByCode.get(code)
  if (!template) throw new Error(`attendee-score: no REASON_TEMPLATES entry for code "${code}"`)
  return {
    code,
    points: Math.round(points),
    evidence,
    en: interpolate(template.en, params),
    si: interpolate(template.si, params),
  }
}

function renderCaveat(code: CaveatCode, params: Record<string, unknown>): Caveat {
  const template = caveatTemplateByCode.get(code)
  if (!template) throw new Error(`attendee-score: no CAVEAT_TEMPLATES entry for code "${code}"`)
  return { code, en: interpolate(template.en, params), si: interpolate(template.si, params) }
}

// ---------------------------------------------------------------------------
// Date / text helpers
// ---------------------------------------------------------------------------

/** Calendar days from `from` to `to`, floored at 0 — never negative (an
 *  evidence item "from the future" relative to its reference date should
 *  never happen, but defensively scores as maximally fresh rather than
 *  crashing or going negative). */
function daysBetween(from: Date, to: Date): number {
  return Math.max(0, differenceInCalendarDays(to, from))
}

/** E1's recency bands: <=14d x1.0, <=45d x0.75, <=120d x0.5, >120d x0.25. */
function e1Recency(days: number): number {
  if (days <= 14) return 1.0
  if (days <= 45) return 0.75
  if (days <= 120) return 0.5
  return 0.25
}

/** E4/E5's recency bands: <=30d x1.0, <=90d x0.7, <=180d x0.4, beyond that
 *  the series window has already excluded it — 0 rather than negative. */
function e4e5Recency(days: number): number {
  if (days <= 30) return 1.0
  if (days <= 90) return 0.7
  if (days <= 180) return 0.4
  return 0
}

const TOPIC_STOPWORDS = new Set([
  'a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'or', 'with',
  'is', 'are', 'be', 'this', 'that', 'it', 'as', 'from', 'by',
])

/** How many non-stopword tokens `text` reduces to — mirrors the tokenizing
 *  spirit of attendee-series.ts's STOPWORDS/hasMeaningfulToken check, kept
 *  local since the two modules solve different problems (this one gates
 *  E3/A1 family availability, not series identity). */
function meaningfulTokenCount(text: string): number {
  const tokens = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
  return tokens.filter((t) => !TOPIC_STOPWORDS.has(t)).length
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Case-insensitive whole-word/-phrase match of any of `tags` inside `text` —
 *  the E3 tech-tag fallback (apps.techTags overlap, no role hit -> 3 pts). */
function findTechTagHit(text: string, tags: string[]): string | null {
  for (const tag of tags) {
    const trimmed = tag.trim()
    if (!trimmed) continue
    const pattern = new RegExp(`\\b${escapeRegExp(trimmed)}\\b`, 'iu')
    const match = pattern.exec(text)
    if (match) return match[0]
  }
  return null
}

function fmtDayMonth(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

// ---------------------------------------------------------------------------
// Family scorers — each is a pure function of (facts, ctx) that returns its
// capped point contribution, the reason line(s) it produces, and how many
// hard-evidence units it contributes (0 for every family except E1/E1b/E2/E3-primary,
// per spec "Tiering": "hard evidence = an E1 item with a resolved userId or a
// qualifying human-added name match, an E2 open task row, an E3 primary
// role/topic hit, or E1b").
// ---------------------------------------------------------------------------

type FamilyResult = { points: number; reasons: Reason[]; hardEvidence: number }

function scoreFollowups(facts: CandidateFacts, ctx: ScoreContext): FamilyResult {
  let raw = 0
  let hardEvidence = 0
  const ids: string[] = []
  const answeredHereIds: string[] = []
  const cite: { text: string; meetingTitle: string; meetingDate: Date }[] = []

  for (const item of facts.followups) {
    const base = (item.humanAdded ? 12 : 6) + (item.kind === 'action' ? 2 : 0)
    const recency = e1Recency(daysBetween(item.sourceMeetingStartsAt, ctx.meetingDay))
    const orphanFactor = item.attribution === 'orphan' ? 0.5 : 1
    const retroFactor = ctx.surface === 'retro' && item.resolvedInThisMeeting ? 1.25 : 1
    raw += base * recency * orphanFactor * retroFactor

    ids.push(item.id)
    cite.push({ text: item.text, meetingTitle: item.sourceMeetingTitle, meetingDate: item.sourceMeetingStartsAt })

    const isHard = item.attribution === 'resolved' || (item.attribution === 'orphan' && item.humanAdded)
    if (isHard) hardEvidence += 1
    if (ctx.surface === 'retro' && item.resolvedInThisMeeting) answeredHereIds.push(item.id)
  }

  const capped = Math.round(Math.min(FAMILY_CAPS.E1, raw))
  const reasons: Reason[] = []
  if (facts.followups.length > 0) {
    const sorted = [...cite].sort((a, b) => b.meetingDate.getTime() - a.meetingDate.getTime())
    const top = sorted.slice(0, 2)
    reasons.push(
      renderReason('followup_open', capped, { ids }, {
        count: facts.followups.length,
        sourceTitle: top[0]?.meetingTitle ?? '',
        sourceDate: top[0] ? fmtDayMonth(top[0].meetingDate) : '',
        items: top.map((c) => `'${c.text}'`).join(', '),
      }),
    )
  }
  if (answeredHereIds.length > 0) {
    reasons.push(renderReason('followup_answered_here', 0, { ids: answeredHereIds }, { count: answeredHereIds.length }))
  }

  return { points: capped, reasons, hardEvidence }
}

function scorePinned(facts: CandidateFacts): { reasons: Reason[]; hardEvidence: number; forcedRequired: boolean } {
  const reasons = facts.pinnedFollowups.map((p) =>
    renderReason('followup_pinned', 0, { ids: [p.id] }, {
      itemText: p.text,
      pinnedByName: p.pinnedByName,
      pinnedDate: fmtDayMonth(p.pinnedOnDate),
    }),
  )
  return { reasons, hardEvidence: facts.pinnedFollowups.length, forcedRequired: facts.pinnedFollowups.length > 0 }
}

function scoreTasks(facts: CandidateFacts, ctx: ScoreContext): FamilyResult {
  if (ctx.appId === null) return { points: 0, reasons: [], hardEvidence: 0 }

  const openCount = facts.openTasks.length
  if (openCount === 0) return { points: 0, reasons: [], hardEvidence: 0 }

  const inProgressCount = facts.openTasks.filter((t) => t.inProgress).length
  const openPts = Math.min(12, 4 * openCount)
  const inProgressPts = Math.min(4, 2 * inProgressCount)
  const sprintBonus = facts.runningSprint && facts.runningSprint.openTaskCount >= 1 ? 4 : 0
  const cap = ctx.surface === 'retro' ? FAMILY_CAPS.E2_RETRO : FAMILY_CAPS.E2_NORMAL
  const inferredFactor = ctx.appIdInferred ? 0.6 : 1

  const capped = Math.round(Math.min(cap, openPts + inProgressPts + sprintBonus) * inferredFactor)
  const ids = facts.openTasks.map((t) => t.id)

  const reasons: Reason[] = [
    renderReason('task_open', capped, { ids }, {
      appName: ctx.appName ?? 'their app',
      openCount,
      inProgressCount,
    }),
  ]
  if (sprintBonus > 0 && facts.runningSprint) {
    reasons.push(
      renderReason('task_sprint', 0, { ids }, {
        appName: ctx.appName ?? 'their app',
        count: facts.runningSprint.openTaskCount,
        sprintName: facts.runningSprint.name,
        sprintEndDate: fmtDayMonth(facts.runningSprint.endDate),
      }),
    )
  }

  return { points: capped, reasons, hardEvidence: openCount }
}

type TopicResult = FamilyResult & { hitType: 'primary' | 'adjacent' | 'tech' | 'none'; thinEvidence: boolean }

function scoreTopic(facts: CandidateFacts, ctx: ScoreContext): TopicResult {
  if (ctx.appId === null) return { points: 0, reasons: [], hardEvidence: 0, hitType: 'none', thinEvidence: false }

  const topicText = `${ctx.meetingTitle} ${ctx.meetingAgenda ?? ''}`.trim()
  if (meaningfulTokenCount(topicText) < 3) {
    return { points: 0, reasons: [], hardEvidence: 0, hitType: 'none', thinEvidence: true }
  }

  const inferredFactor = ctx.appIdInferred ? 0.6 : 1
  const match = matchAgendaTopic(topicText, facts.roleTokens)
  const role = facts.roleTokens[0] ?? 'their role'

  if (match.hit === 'primary') {
    const pts = Math.round(14 * inferredFactor)
    return {
      points: pts,
      reasons: [renderReason('role_topic', pts, { ids: [] }, { quote: match.quote, role })],
      hardEvidence: 1,
      hitType: 'primary',
      thinEvidence: false,
    }
  }
  if (match.hit === 'adjacent') {
    const pts = Math.round(7 * inferredFactor)
    return {
      points: pts,
      reasons: [renderReason('role_topic', pts, { ids: [] }, { quote: match.quote, role })],
      hardEvidence: 0,
      hitType: 'adjacent',
      thinEvidence: false,
    }
  }

  const techTag = findTechTagHit(topicText, ctx.appTechTags)
  if (techTag) {
    const pts = Math.round(3 * inferredFactor)
    return {
      points: pts,
      reasons: [renderReason('role_topic', pts, { ids: [] }, { quote: techTag, role: ctx.appName ?? role })],
      hardEvidence: 0,
      hitType: 'tech',
      thinEvidence: false,
    }
  }

  return { points: 0, reasons: [], hardEvidence: 0, hitType: 'none', thinEvidence: false }
}

function scoreDiscussion(facts: CandidateFacts, ctx: ScoreContext): FamilyResult {
  if (facts.discussionMeetings.length === 0) return { points: 0, reasons: [], hardEvidence: 0 }

  let raw = 0
  let citedPoints = 0
  const ids: string[] = []
  for (const m of facts.discussionMeetings) {
    const pts = Math.min(3, m.points)
    const recency = e4e5Recency(daysBetween(m.meetingStartsAt, ctx.meetingDay))
    raw += pts * 2 * recency
    citedPoints += pts
    ids.push(m.meetingId)
  }

  const capped = Math.round(Math.min(FAMILY_CAPS.E4, raw))
  const reasons = [
    renderReason('discussed', capped, { ids }, {
      count: facts.discussionMeetings.length,
      seriesTitle: ctx.seriesTitle ?? ctx.meetingTitle,
      points: citedPoints,
    }),
  ]
  return { points: capped, reasons, hardEvidence: 0 }
}

function scoreVoice(facts: CandidateFacts, ctx: ScoreContext): FamilyResult {
  let weightedSum = 0
  let weightTotal = 0
  const ids: string[] = []
  let candidateTurnsTotal = 0
  let resolvedTurnsTotalSum = 0

  for (const m of facts.voiceMeetings) {
    if (m.resolvedTurnsTotal <= 0 || m.resolvedSpeakerCount <= 0) continue
    const weight = e4e5Recency(daysBetween(m.meetingStartsAt, ctx.meetingDay))
    if (weight <= 0) continue

    const share = m.candidateTurns / m.resolvedTurnsTotal
    const expected = 1 / m.resolvedSpeakerCount
    const ratio = expected > 0 ? share / expected : 0
    const band = ratio >= 0.75 ? 8 : ratio >= 0.35 ? 4 : 2

    weightedSum += band * weight
    weightTotal += weight
    ids.push(m.meetingId)
    candidateTurnsTotal += m.candidateTurns
    resolvedTurnsTotalSum += m.resolvedTurnsTotal
  }

  if (weightTotal === 0) return { points: 0, reasons: [], hardEvidence: 0 }

  const capped = Math.round(Math.min(FAMILY_CAPS.E5, weightedSum / weightTotal))
  const reasons = [
    renderReason('spoke', capped, { ids }, {
      candidateTurns: candidateTurnsTotal,
      totalTurns: resolvedTurnsTotalSum,
      meetingCount: ids.length,
      seriesTitle: ctx.seriesTitle ?? ctx.meetingTitle,
    }),
  ]
  return { points: capped, reasons, hardEvidence: 0 }
}

function scoreOwnership(facts: CandidateFacts, ctx: ScoreContext): FamilyResult {
  if (ctx.appId === null) return { points: 0, reasons: [], hardEvidence: 0 }

  const inferredFactor = ctx.appIdInferred ? 0.6 : 1
  const reasons: Reason[] = []
  let total = 0

  if (facts.isLead) {
    const pts = Math.round(8 * inferredFactor)
    total += pts
    reasons.push(renderReason('lead', pts, { ids: [] }, { appName: ctx.appName ?? 'their app' }))
  }

  if (facts.assignment && facts.assignment.allocationPct > 0) {
    const pct = facts.assignment.allocationPct
    const band = pct >= 50 ? 4 : pct >= 25 ? 3 : 2
    const pts = Math.round(band * inferredFactor)
    total += pts
    reasons.push(renderReason('allocated', pts, { ids: [] }, { appName: ctx.appName ?? 'their app', pct }))
  } else if (!facts.isLead && facts.leadAllowlistRoleHeuristic) {
    const pts = Math.round(3 * inferredFactor)
    total += pts
    reasons.push(
      renderReason('lead_role_heuristic', pts, { ids: [] }, {
        appName: ctx.appName ?? 'their app',
        role: facts.roleTokens[0] ?? 'their role',
      }),
    )
  }

  return { points: Math.min(FAMILY_CAPS.E6, total), reasons, hardEvidence: 0 }
}

function scoreAttendance(facts: CandidateFacts, ctx: ScoreContext): FamilyResult {
  if (!facts.attendance || facts.attendance.occurrences < 2) return { points: 0, reasons: [], hardEvidence: 0 }

  const ratio = facts.attendance.attended / facts.attendance.occurrences
  const pts = ratio >= 0.8 ? 6 : ratio >= 0.5 ? 4 : ratio >= 0.25 ? 2 : 0
  const reasons =
    pts > 0
      ? [
          renderReason('attended', pts, { ids: [] }, {
            attended: facts.attendance.attended,
            occurrences: facts.attendance.occurrences,
            seriesTitle: ctx.seriesTitle ?? ctx.meetingTitle,
          }),
        ]
      : []
  return { points: pts, reasons, hardEvidence: 0 }
}

// ---------------------------------------------------------------------------
// scoreCandidate
// ---------------------------------------------------------------------------

export function scoreCandidate(facts: CandidateFacts, ctx: ScoreContext): ScoredCandidate {
  const reasons: Reason[] = []
  const caveats: Caveat[] = []
  let hardEvidenceCount = 0

  const e1 = scoreFollowups(facts, ctx)
  reasons.push(...e1.reasons)
  hardEvidenceCount += e1.hardEvidence

  const pinned = scorePinned(facts)
  reasons.push(...pinned.reasons)
  hardEvidenceCount += pinned.hardEvidence

  const e2 = scoreTasks(facts, ctx)
  reasons.push(...e2.reasons)
  hardEvidenceCount += e2.hardEvidence

  const e3 = scoreTopic(facts, ctx)
  reasons.push(...e3.reasons)
  hardEvidenceCount += e3.hardEvidence
  if (e3.thinEvidence) caveats.push(renderCaveat('thin_evidence', {}))

  const e4 = scoreDiscussion(facts, ctx)
  reasons.push(...e4.reasons)

  const e5 = scoreVoice(facts, ctx)
  reasons.push(...e5.reasons)
  if (facts.unresolvedVoiceMeetingsCount > 0) {
    caveats.push(
      renderCaveat('speaker_unresolved', {
        unresolved: facts.unresolvedVoiceMeetingsCount,
        total: facts.unresolvedVoiceMeetingsCount + facts.voiceMeetings.length,
      }),
    )
  }

  const e6 = scoreOwnership(facts, ctx)
  reasons.push(...e6.reasons)

  const e7 = scoreAttendance(facts, ctx)
  reasons.push(...e7.reasons)

  if (ctx.seriesTitle && ctx.seriesOccurrenceCount < 2) {
    caveats.push(renderCaveat('no_series', { seriesTitle: ctx.seriesTitle, count: ctx.seriesOccurrenceCount }))
  }
  if (ctx.appId !== null && ctx.appIdInferred) {
    caveats.push(renderCaveat('inferred_app', { appName: ctx.appName ?? 'the app' }))
  }
  if (ctx.aiUnavailable) {
    caveats.push(renderCaveat('ai_unavailable', {}))
  }

  const scoreDet = Math.min(90, e1.points + e2.points + e3.points + e4.points + e5.points + e6.points + e7.points)

  let a1Points = 0
  if (!ctx.aiUnavailable && facts.aiRelevance) {
    a1Points = Math.max(0, Math.min(FAMILY_CAPS.A1, Math.round(facts.aiRelevance.points)))
    if (a1Points > 0) {
      reasons.push(
        renderReason('agenda_match', a1Points, { ids: facts.aiRelevance.evidenceId ? [facts.aiRelevance.evidenceId] : [] }, {
          agendaQuote: facts.aiRelevance.agendaQuote,
          evidenceQuote: facts.aiRelevance.evidenceQuote,
        }),
      )
    }
  }
  const scoreTotal = Math.min(100, scoreDet + a1Points)

  if (facts.isOrganizer) reasons.push(renderReason('organizer', 0, { ids: [] }, { meetingTitle: ctx.meetingTitle }))
  if (facts.selfOptIn) reasons.push(renderReason('opted_in', 0, { ids: [] }, { seriesTitle: ctx.seriesTitle ?? ctx.meetingTitle }))
  if (facts.existingAttendeeRow) reasons.push(renderReason('already_invited', 0, { ids: [] }, { meetingTitle: ctx.meetingTitle }))
  if (facts.attendedPreviousOccurrence) {
    reasons.push(
      renderReason('previous_occurrence', 0, { ids: [] }, {
        seriesTitle: ctx.seriesTitle ?? ctx.meetingTitle,
        date: facts.previousOccurrenceDate ? fmtDayMonth(facts.previousOccurrenceDate) : fmtDayMonth(ctx.meetingDay),
      }),
    )
  }

  let isNew = false
  if (facts.candidateJoinedAt) {
    const daysSinceJoined = daysBetween(facts.candidateJoinedAt, ctx.today)
    isNew = daysSinceJoined < NEW_PERSON_DAYS
    if (isNew) caveats.push(renderCaveat('new_person', { appName: ctx.appName ?? 'the app', days: daysSinceJoined }))
  }
  if (facts.isReturner) caveats.push(renderCaveat('returner', { appName: ctx.appName ?? 'the app' }))

  // ---- R1-R4: arithmetic tiering ----
  let tier: Tier =
    scoreDet >= REQUIRED_MIN_SCORE_DET && hardEvidenceCount >= 1
      ? 'required'
      : scoreTotal >= OPTIONAL_MIN_SCORE_TOTAL
        ? 'optional'
        : 'skip'

  // ---- R5: floors — minimum tier optional. No floor may ever LOWER the tier
  // (see `maxTier`) — this is the structural half of "no signal subtracts". ----
  const floors = [
    facts.assignment !== null && facts.assignment.allocationPct > 0,
    facts.isLead,
    hardEvidenceCount >= 1,
    isNew,
    facts.existingAttendeeRow,
    facts.attendedPreviousOccurrence,
    facts.selfOptIn,
    facts.isReturner,
    ctx.poolSize <= 4, // TINY TEAM: skip disabled entirely
  ]
  if (floors.some(Boolean)) tier = maxTier(tier, 'optional')

  // ---- R6: E3 required floor — primary role/topic hit + assigned to the app. ----
  const assignedToApp = ctx.appId !== null && (facts.assignment !== null || facts.isLead)
  if (ctx.appId !== null && e3.hitType === 'primary' && assignedToApp) {
    tier = 'required'
  }

  // ---- R8: CEILING — no appId, no app inferred: nobody may be required except
  // the organizer, a pinned-followup holder, or a series regular. ----
  if (ctx.appId === null && tier === 'required') {
    const seriesRegular =
      facts.attendance !== null && facts.attendance.occurrences >= 3 && facts.attendance.attended / facts.attendance.occurrences >= 0.75
    const exempt = facts.isOrganizer || pinned.forcedRequired || seriesRegular
    if (!exempt) tier = 'optional'
  }

  // ---- R7: HARD OVERRIDES, beating everything above (organizer; a pinned
  // follow-up). Applied last so neither R5's floors nor R8's ceiling can ever
  // touch them. ----
  if (facts.isOrganizer || pinned.forcedRequired) tier = 'required'

  reasons.sort((a, b) => b.points - a.points)

  return { userId: facts.userId, scoreDet, scoreTotal, hardEvidenceCount, tier, reasons, caveats }
}

// ---------------------------------------------------------------------------
// tierAll
// ---------------------------------------------------------------------------

/** Reason codes that, if present, mean this candidate's tier came from a hard
 *  override (R7) — survives ABSTAIN mode unchanged. Deliberately narrow: the
 *  spec's abstain description names exactly "organizer required" and nothing
 *  else as surviving at the required tier, so R6 (E3 required floor) is
 *  intentionally NOT included here — one primary role/topic hit is still only
 *  one candidate's worth of evidence, which is exactly the situation abstain
 *  exists to be honest about. */
const ABSTAIN_OVERRIDE_CODES = new Set<ReasonCode>(['organizer', 'followup_pinned'])

/** Reason/caveat codes that mean this candidate is at least "assigned to the
 *  app" or otherwise floor-qualified (R5) — these survive ABSTAIN mode as
 *  `optional`, matching the spec's "everyone eligible and assigned to the app
 *  pre-filled optional". Deliberately EXCLUDES `lead_role_heuristic` (spec:
 *  "no floor") and every pure-arithmetic reason (task_open, role_topic,
 *  discussed, spoke, attended, agenda_match) — those reflect scoring-mode
 *  evidence, not the structural floors abstain mode is built to honor. */
const ABSTAIN_FLOOR_REASON_CODES = new Set<ReasonCode>(['lead', 'allocated', 'opted_in', 'previous_occurrence', 'already_invited'])
const ABSTAIN_FLOOR_CAVEAT_CODES = new Set<CaveatCode>(['new_person', 'returner'])

export function tierAll(scored: ScoredCandidate[], ctx: ScoreContext): RecommendationRun {
  const hardEvidenceCandidates = new Set(scored.filter((c) => c.hardEvidenceCount >= 1).map((c) => c.userId))
  const abstained = hardEvidenceCandidates.size < 2

  let finalScored: ScoredCandidate[]
  if (abstained) {
    const tinyPool = ctx.poolSize <= 4
    finalScored = scored.map((c) => {
      const hasOverride = c.reasons.some((r) => ABSTAIN_OVERRIDE_CODES.has(r.code))
      if (hasOverride) return { ...c, tier: 'required' as Tier }
      const hasFloor =
        tinyPool ||
        c.hardEvidenceCount >= 1 ||
        c.reasons.some((r) => ABSTAIN_FLOOR_REASON_CODES.has(r.code)) ||
        c.caveats.some((cv) => ABSTAIN_FLOOR_CAVEAT_CODES.has(cv.code))
      return { ...c, tier: (hasFloor ? 'optional' : 'skip') as Tier }
    })
  } else {
    finalScored = scored
  }

  const requiredCount = finalScored.filter((c) => c.tier === 'required').length
  return {
    abstained,
    scored: finalScored,
    requiredCount,
    requiredOverflow: requiredCount > 8, // R10 soft cap — warning only, never a demotion
  }
}
