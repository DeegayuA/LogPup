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
  | 'role_topic_tech'
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
  /** Structured floor/override flags (added in review round 1, M7) — lets
   *  `tierAll`'s ABSTAIN-mode reconciliation read actual facts instead of
   *  pattern-matching `reasons`/`caveats` codes, which would silently break
   *  the moment a future display layer suppresses or renames a reason for
   *  presentation (the spec itself asks for exactly that: `allocated`
   *  "always rendered last and de-emphasised"). */
  floors: {
    /** R7: organizer, or a follow-up pinned to this meeting — always
     *  required, beats every floor and ceiling. */
    hardOverride: boolean
    /** R5: any condition that floors the minimum tier to `optional`
     *  (allocation, leadId, hardEvidence>=1, new person, existing attendee
     *  row, previous-occurrence attendee, self opt-in, returner). Excludes
     *  the tiny-pool floor, which is a pool-level fact from
     *  `ScoreContext.poolSize`, not a per-candidate one. */
    softFloor: boolean
  }
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

/** M6 (review round 1): every template that interpolates a `{role}`
 *  placeholder previously fell back to the literal string `'their role'` when
 *  `roleTokens` was empty — which, substituted into "Their role, {role}, is
 *  on..." or "...their role is {role}.", rendered the self-contradicting
 *  "Their role, their role, is on Vela's leadership allowlist." Use a
 *  distinct fallback everywhere a role token is missing. */
const FALLBACK_ROLE = 'an unspecified role'

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
    // I6 (review round 1): the tech-tag-only E3 fallback used to reuse
    // `role_topic`'s "...their role is {role}." template with `role` set to
    // the APP NAME (there is no candidate role to cite — a techTag match is
    // role-independent by construction), rendering nonsense like "their role
    // is Vela." This branch gets its own honest template instead.
    code: 'role_topic_tech',
    en: "Agenda mentions '{quote}', part of {appName}'s tech stack.",
    si: "න්‍යාය පත්‍රයේ '{quote}' සඳහන් වේ, එය {appName} හි තාක්ෂණික තොගයේ කොටසකි.",
  },
  {
    code: 'discussed',
    en: 'Named in the AI notes of {count} past {seriesTitle} meeting(s) ({points} discussion point(s)).',
    si: 'අතීත {seriesTitle} රැස්වීම් {count}ක AI සටහන්වල නම් සඳහන් වේ (සාකච්ඡා ලකුණු {points}ක්).',
  },
  {
    // I1 (review round 2): the old template summed turns/total ACROSS every
    // kept meeting while the score itself came from a single best meeting
    // (round 1's fix) — the rendered numbers no longer recomputed to the
    // points shown. Now cites the WINNING meeting's own turns/total/date;
    // {meetingCount} still names how many recordings were considered, but
    // never mixes their figures together.
    code: 'spoke',
    en: 'Took {candidateTurns} of {totalTurns} attributed speaking turns in {meetingTitle} ({sourceDate}) — their best of {meetingCount} recorded {seriesTitle} meeting(s).',
    si: '{seriesTitle} හි පටිගත කළ රැස්වීම් {meetingCount}න් වඩාත්ම හොඳ ප්‍රතිඵලය {meetingTitle} ({sourceDate}) හිදී ලැබුණි — ආරෝපිත කථන වාරවලින් {totalTurns}න් {candidateTurns}ක් ගත්තා.',
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
    // M2 (review round 1): gained a proper-noun placeholder — every entry in
    // this table is now held to the same NUMBER/PROPER-NOUN/DATE lint as
    // REASON_TEMPLATES, and this one previously carried none.
    code: 'ai_unavailable',
    en: 'AI relevance scoring was unavailable for {meetingTitle} — the deterministic score is unaffected.',
    si: '{meetingTitle} සඳහා AI අදාළත්ව ලකුණු ලබාගත නොහැකි විය — නිශ්චිත ලකුණු බලපෑමට ලක් නොවේ.',
  },
  {
    code: 'thin_evidence',
    en: 'LogPup does not have enough agenda or title text to match roles for {meetingTitle}.',
    si: '{meetingTitle} සඳහා භූමිකා ගැලපීමට ප්‍රමාණවත් න්‍යාය පත්‍ර හෝ මාතෘකා පෙළක් LogPup සතුව නැත.',
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
  const answeredHereIds: string[] = []
  // I5 (review round 1): grouped by source meeting, not lumped into one
  // citation — the previous version cited every item's count under the
  // SINGLE most-recent item's meeting/date, so items from Vela Weekly, Orbit
  // Retro and Client Sync all rendered as "Owes 3 open item(s) from Vela
  // Weekly (11 Aug)", which is false for two of the three. Grouping key is
  // title+timestamp (not a stored meeting id — `FollowupEvidenceItem` has
  // none), which is safe here: every item sharing a title AND an exact
  // millisecond `sourceMeetingStartsAt` genuinely came from one meeting.
  const byMeeting = new Map<string, { title: string; date: Date; items: { id: string; text: string }[] }>()

  for (const item of facts.followups) {
    const base = (item.humanAdded ? 12 : 6) + (item.kind === 'action' ? 2 : 0)
    const recency = e1Recency(daysBetween(item.sourceMeetingStartsAt, ctx.meetingDay))
    const orphanFactor = item.attribution === 'orphan' ? 0.5 : 1
    const retroFactor = ctx.surface === 'retro' && item.resolvedInThisMeeting ? 1.25 : 1
    raw += base * recency * orphanFactor * retroFactor

    const key = `${item.sourceMeetingTitle}__${item.sourceMeetingStartsAt.getTime()}`
    let group = byMeeting.get(key)
    if (!group) {
      group = { title: item.sourceMeetingTitle, date: item.sourceMeetingStartsAt, items: [] }
      byMeeting.set(key, group)
    }
    group.items.push({ id: item.id, text: item.text })

    const isHard = item.attribution === 'resolved' || (item.attribution === 'orphan' && item.humanAdded)
    if (isHard) hardEvidence += 1
    if (ctx.surface === 'retro' && item.resolvedInThisMeeting) answeredHereIds.push(item.id)
  }

  const capped = Math.round(Math.min(FAMILY_CAPS.E1, raw))
  const reasons: Reason[] = []
  if (facts.followups.length > 0) {
    // Most-recent group first; it alone carries the family's real point
    // total (the already-established "primary reason carries the family
    // total, the rest are 0-point informational lines" pattern used
    // throughout this module) — every group's count/date/items are still
    // individually true of ONLY that meeting.
    const groups = [...byMeeting.values()].sort((a, b) => b.date.getTime() - a.date.getTime())
    groups.forEach((group, i) => {
      const top = group.items.slice(0, 2)
      reasons.push(
        renderReason('followup_open', i === 0 ? capped : 0, { ids: group.items.map((it) => it.id) }, {
          count: group.items.length,
          sourceTitle: group.title,
          sourceDate: fmtDayMonth(group.date),
          items: top.map((it) => `'${it.text}'`).join(', '),
        }),
      )
    })
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
  const role = facts.roleTokens[0] ?? FALLBACK_ROLE

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
    // I6: own template — a techTag hit has no candidate role to cite at all.
    const pts = Math.round(3 * inferredFactor)
    return {
      points: pts,
      reasons: [renderReason('role_topic_tech', pts, { ids: [] }, { quote: techTag, appName: ctx.appName ?? 'their app' })],
      hardEvidence: 0,
      hitType: 'tech',
      thinEvidence: false,
    }
  }

  return { points: 0, reasons: [], hardEvidence: 0, hitType: 'none', thinEvidence: false }
}

function scoreDiscussion(facts: CandidateFacts, ctx: ScoreContext): FamilyResult {
  // I2: E4 is a series signal — a series with fewer than 2 established occurrences
  // is UNAVAILABLE for it (spec "Series rule"), the same way E2/E3/E6 are hard-
  // zeroed on `appId === null` regardless of what the caller populated.
  if (ctx.seriesOccurrenceCount < 2) return { points: 0, reasons: [], hardEvidence: 0 }
  if (facts.discussionMeetings.length === 0) return { points: 0, reasons: [], hardEvidence: 0 }

  let raw = 0
  let citedPoints = 0
  const ids: string[] = []
  for (const m of facts.discussionMeetings) {
    // C2: meeting_ai_notes.perPerson is bare, untyped jsonb (schema.ts has no
    // $type<>() on it) — unvalidated model output, and the only family input
    // with no natural floor. A negative `points` value (a malformed/adversarial
    // row) must never drive scoreDet negative; clamp BOTH ends, not just the
    // spec's upper cap of 3.
    // M6 (review round 2): `Math.max`/`Math.min` both propagate NaN silently
    // (every comparison against NaN is false) — the SAME untyped-jsonb threat
    // model that produces a negative number can just as easily produce NaN,
    // null coerced to 0 (harmless) or, from a stricter runtime, a string.
    // `Number.isFinite` is the one guard that rejects NaN, +/-Infinity, and
    // non-numbers alike before the clamp ever runs.
    const pts = Number.isFinite(m.points) ? Math.max(0, Math.min(3, m.points)) : 0
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

/**
 * C1 (review round 1): a weighted AVERAGE across kept meetings meant that
 * adding a genuinely-attended-but-lower-engagement recording could LOWER
 * this family's total — e.g. two human follow-ups (24 det pts, hard
 * evidence) + one recording at 15/30 turns over 3 speakers (band 8) scored
 * 32 -> required; adding a second, real recording at 2/40 turns over 4
 * speakers (band 2) dragged the WEIGHTED AVERAGE down to 29 -> optional.
 * Taking part in more of the series demoted the candidate. Pooling turns
 * (Σturns/Σresolved) was evaluated too and is still non-monotone at band
 * edges for the same reason: any denominator-based combination can go down
 * when you add a real numerator/denominator pair whose ratio sits below the
 * running average/pooled ratio.
 *
 * FIX (a DELIBERATE DEVIATION from the spec's literal "Averaged over kept
 * meetings" — flagged here for the spec to be amended): take the BEST value
 * across kept meetings, never the average. `max` over a set of non-negative
 * values is monotone non-decreasing as you add or remove elements, which is
 * exactly the invariant "no signal may ever subtract" requires, and that
 * invariant is stated as outranking every other rule in this ledger.
 *
 * I2 (review round 2): round 1's fix took the max of the raw BAND but
 * dropped recency decay entirely (the loop only ever checked `recency > 0`,
 * a pass/fail window test, never used the multiplier itself) — so a band-8
 * recording scored 8 at 0 days and at 179 days alike, then fell off a cliff
 * to 0 at 181 days, while E4 right next to it still decays smoothly
 * (x1.0/x0.7/x0.4). The spec's own words are "Averaged over kept meetings
 * WITH RECENCY DECAY" — round 1's deviation note above covers the averaging
 * half only. FIX: take the max of `band * recencyWeight`, not the max of the
 * raw band — `max` stays monotone regardless of what each value is
 * individually weighted by, so this costs nothing on the C1 invariant while
 * restoring decay. The deviation is now precisely scoped: the AVERAGING
 * went, the DECAY stayed.
 */
function scoreVoice(facts: CandidateFacts, ctx: ScoreContext): FamilyResult {
  // I2/I3 (round 1): series signal — unavailable below 2 established occurrences.
  if (ctx.seriesOccurrenceCount < 2) return { points: 0, reasons: [], hardEvidence: 0 }

  let best: {
    weighted: number
    meetingId: string
    meetingTitle: string
    meetingStartsAt: Date
    candidateTurns: number
    resolvedTurnsTotal: number
  } | null = null
  const ids: string[] = []

  for (const m of facts.voiceMeetings) {
    if (m.resolvedTurnsTotal <= 0 || m.resolvedSpeakerCount <= 0) continue
    const weight = e4e5Recency(daysBetween(m.meetingStartsAt, ctx.meetingDay))
    if (weight <= 0) continue

    const share = m.candidateTurns / m.resolvedTurnsTotal
    const expected = 1 / m.resolvedSpeakerCount
    const ratio = expected > 0 ? share / expected : 0
    const band = ratio >= 0.75 ? 8 : ratio >= 0.35 ? 4 : 2
    const weighted = band * weight

    ids.push(m.meetingId)
    if (!best || weighted > best.weighted) {
      best = {
        weighted,
        meetingId: m.meetingId,
        meetingTitle: m.meetingTitle,
        meetingStartsAt: m.meetingStartsAt,
        candidateTurns: m.candidateTurns,
        resolvedTurnsTotal: m.resolvedTurnsTotal,
      }
    }
  }

  if (!best) return { points: 0, reasons: [], hardEvidence: 0 }

  const capped = Math.round(Math.min(FAMILY_CAPS.E5, best.weighted))
  // I1 (round 2): cite the WINNING meeting's own turns/total/date — round 1's
  // fix switched points to "best meeting" but left the citation SUMMING
  // across every kept meeting (a leftover from the averaging design), so the
  // rendered line no longer recomputed to the score it carried (reproduced:
  // "Took 9 of 210 ... across 2 meetings" carrying 8 points, when 9/210
  // alone recomputes to band 2). Every number in this line is now the
  // winning meeting's own, so the citation is disprovable exactly by opening
  // that one meeting, and it recomputes to the points shown.
  const reasons = [
    renderReason('spoke', capped, { ids: [best.meetingId] }, {
      candidateTurns: best.candidateTurns,
      totalTurns: best.resolvedTurnsTotal,
      meetingTitle: best.meetingTitle,
      sourceDate: fmtDayMonth(best.meetingStartsAt),
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
  }

  // I1 (review round 1): this used to be an `else if`, so the heuristic (+3)
  // only ever appeared when NO allocation row existed — meaning an assignment
  // at the lowest band (2 pts) scored LESS than deleting that same assignment
  // and falling back to the heuristic alone (3 pts). Removing evidence must
  // never raise a score. Making the two terms independently ADDITIVE (both
  // still capped at FAMILY_CAPS.E6 below) removes the swap entirely: this
  // term's presence/absence now depends ONLY on `leadAllowlistRoleHeuristic`
  // itself, never on whether `assignment` happens to also be populated.
  if (!facts.isLead && facts.leadAllowlistRoleHeuristic) {
    const pts = Math.round(3 * inferredFactor)
    total += pts
    reasons.push(
      renderReason('lead_role_heuristic', pts, { ids: [] }, {
        appName: ctx.appName ?? 'their app',
        role: facts.roleTokens[0] ?? FALLBACK_ROLE,
      }),
    )
  }

  return { points: Math.min(FAMILY_CAPS.E6, total), reasons, hardEvidence: 0 }
}

function scoreAttendance(facts: CandidateFacts, ctx: ScoreContext): FamilyResult {
  // I3 (review round 2): `facts.attendance.occurrences` and
  // `ctx.seriesOccurrenceCount` are DIFFERENT quantities — the former is
  // this candidate's own attendance-history fact, the latter is the run's
  // series-establishment fact — so gating on only the first meant
  // `seriesOccurrenceCount: 1` (series not established) could still emit 6
  // E7 points, alongside a `no_series` caveat that directly contradicted
  // them. Same class as I2's E4/E5 gate; applied here too, defensively.
  if (ctx.seriesOccurrenceCount < 2) return { points: 0, reasons: [], hardEvidence: 0 }
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

  // M5 (review round 1): spec ("Degradation", NO appId) says every E2/E3/E6
  // reason under a LOW-CONFIDENCE inferred app is prefixed "inferred:" — this
  // was previously only surfaced as a separate `inferred_app` caveat, never
  // on the reason lines themselves. Applied below to each family's reasons.
  const inferredPrefix = ctx.appId !== null && ctx.appIdInferred === true
  const withInferredPrefix = (r: Reason): Reason =>
    inferredPrefix ? { ...r, en: `Inferred: ${r.en}`, si: `අනුමානය: ${r.si}` } : r

  const e2 = scoreTasks(facts, ctx)
  reasons.push(...e2.reasons.map(withInferredPrefix))
  hardEvidenceCount += e2.hardEvidence

  const e3 = scoreTopic(facts, ctx)
  reasons.push(...e3.reasons.map(withInferredPrefix))
  hardEvidenceCount += e3.hardEvidence
  if (e3.thinEvidence) caveats.push(renderCaveat('thin_evidence', { meetingTitle: ctx.meetingTitle }))

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
  reasons.push(...e6.reasons.map(withInferredPrefix))

  const e7 = scoreAttendance(facts, ctx)
  reasons.push(...e7.reasons)

  // M4 (review round 1): previously gated on `ctx.seriesTitle` being truthy,
  // which suppressed this caveat EXACTLY when there is no series at all —
  // the case that most needs the explanation. Gate on the occurrence count
  // alone; fall back to the meeting's own title when no series title exists.
  if (ctx.seriesOccurrenceCount < 2) {
    caveats.push(
      renderCaveat('no_series', { seriesTitle: ctx.seriesTitle ?? ctx.meetingTitle, count: ctx.seriesOccurrenceCount }),
    )
  }
  if (ctx.appId !== null && ctx.appIdInferred) {
    caveats.push(renderCaveat('inferred_app', { appName: ctx.appName ?? 'the app' }))
  }
  if (ctx.aiUnavailable) {
    // M2: give this caveat a proper-noun placeholder too, per the same lint
    // every REASON_TEMPLATES entry is held to.
    caveats.push(renderCaveat('ai_unavailable', { meetingTitle: ctx.meetingTitle }))
  }

  const scoreDet = Math.max(
    0,
    Math.min(90, e1.points + e2.points + e3.points + e4.points + e5.points + e6.points + e7.points),
  )

  // I3 (review round 1): A1 must not be credited when the agenda itself
  // doesn't qualify (spec A1: "Runs ONLY when meetings.agenda is non-empty
  // after trim AND tokenizes to >=3 non-stopword words; otherwise the model
  // is not called at all"). This was previously ungated here, so a caller
  // that still handed over a populated (already-validated) `aiRelevance` —
  // e.g. a stale cache entry from before the agenda was cleared — could
  // credit points the AI was never supposed to have been asked to produce.
  // Deliberately checks the AGENDA ALONE (not `${title} ${agenda}}`, unlike
  // E3's fallback), matching the spec's literal gate.
  const agendaQualifies = meaningfulTokenCount(ctx.meetingAgenda ?? '') >= 3
  let a1Points = 0
  if (!ctx.aiUnavailable && agendaQualifies && facts.aiRelevance) {
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
  const scoreTotal = Math.max(0, Math.min(100, scoreDet + a1Points))

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
  // (see `maxTier`) — this is the structural half of "no signal subtracts".
  // M4 (review round 2): kept as a PER-CANDIDATE array — the tiny-pool floor
  // is a POOL-level fact (`ctx.poolSize`, identical for every candidate in
  // the run), so it's applied alongside this array rather than inside it,
  // matching `ScoredCandidate.floors.softFloor`'s own doc ("excludes the
  // tiny-pool floor"). Previously the array and the doc disagreed — harmless
  // today only because `tierAll` ORs `tinyPool` in separately regardless. ----
  const perCandidateFloors = [
    facts.assignment !== null && facts.assignment.allocationPct > 0,
    facts.isLead,
    hardEvidenceCount >= 1,
    isNew,
    facts.existingAttendeeRow,
    facts.attendedPreviousOccurrence,
    facts.selfOptIn,
    facts.isReturner,
  ]
  const tinyPool = ctx.poolSize <= 4 // TINY TEAM: skip disabled entirely
  if (perCandidateFloors.some(Boolean) || tinyPool) tier = maxTier(tier, 'optional')

  // ---- R6: E3 required floor — primary role/topic hit + assigned to the app.
  // I4 (review round 1): excludes an INFERRED app. This is the strongest,
  // least-overridable tier in the whole ledger (it beats R2-R4's arithmetic
  // outright), and the x0.6 confidence multiplier exists PRECISELY because an
  // inferred app is a guess — a floor that ignores its own confidence signal
  // could required someone off a low-confidence app match with as little as
  // 9 det points (14*0.6 rounded, plus a floor). An inferred-app primary hit
  // still floors to `optional` via R5's ordinary allocation/lead checks. ----
  const assignedToApp = ctx.appId !== null && (facts.assignment !== null || facts.isLead)
  if (ctx.appId !== null && !ctx.appIdInferred && e3.hitType === 'primary' && assignedToApp) {
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

  // M7 (review round 1): `tierAll`'s ABSTAIN-mode reconciliation used to
  // re-derive "is this candidate hard-overridden / floor-qualified" by
  // pattern-matching specific `reasons`/`caveats` codes — correct today, but
  // silently fragile: the spec's own "always render `allocated` last and
  // de-emphasised" instruction is exactly the kind of future display-layer
  // change (suppressing/reordering/renaming a reason for presentation) that
  // would quietly break the match and change who gets pre-filled in abstain
  // mode. Pass the actual booleans through instead, computed from the same
  // `floors` array and `facts` used for the real (non-abstain) R5/R7 logic
  // above, so ABSTAIN mode never has to reverse-engineer them from text.
  const hardOverride = facts.isOrganizer || pinned.forcedRequired
  const softFloor = perCandidateFloors.some(Boolean)

  return {
    userId: facts.userId,
    scoreDet,
    scoreTotal,
    hardEvidenceCount,
    tier,
    reasons,
    caveats,
    floors: { hardOverride, softFloor },
  }
}

// ---------------------------------------------------------------------------
// tierAll
// ---------------------------------------------------------------------------

/**
 * M7 (review round 1): ABSTAIN-mode reconciliation used to re-derive "was
 * this candidate hard-overridden / floor-qualified" by pattern-matching
 * `reasons`/`caveats` codes — replaced with the structured
 * `ScoredCandidate.floors` flags `scoreCandidate` now computes directly from
 * `facts`, so a future display-layer change to the reason lines (the spec
 * itself asks for `allocated` to be "rendered last and de-emphasised") can
 * never silently change who gets pre-filled in abstain mode.
 *
 * The override/floor SEMANTICS are unchanged from round 1: `hardOverride`
 * (organizer or a pinned follow-up) survives ABSTAIN as `required`;
 * `softFloor` (any R5 floor) survives as `optional`; everything else — every
 * pure-arithmetic family (task_open, role_topic, discussed, spoke, attended,
 * agenda_match) and the deliberately-unfloored `lead_role_heuristic` — is
 * `skip`, exactly as before.
 */
/**
 * How many people a room holds before it stops being a conversation.
 *
 * R10's soft cap, NAMED rather than inlined because it stopped being local:
 * R6 COVER-TOGETHER refuses to build a group past this same number
 * (coverage.ts). A second literal `8` elsewhere would be a second opinion
 * about the same question, and the two would drift the first time either was
 * tuned.
 *
 * Soft here, hard there, and the difference is deliberate: this module
 * describes a room somebody already booked, so it warns; R6 proposes one that
 * does not exist yet, so it declines to propose it at all.
 */
export const ROOM_CAP = 8

export function tierAll(scored: ScoredCandidate[], ctx: ScoreContext): RecommendationRun {
  const hardEvidenceCandidates = new Set(scored.filter((c) => c.hardEvidenceCount >= 1).map((c) => c.userId))
  const abstained = hardEvidenceCandidates.size < 2

  let finalScored: ScoredCandidate[]
  if (abstained) {
    const tinyPool = ctx.poolSize <= 4
    finalScored = scored.map((c) => {
      if (c.floors.hardOverride) return { ...c, tier: 'required' as Tier }
      const hasFloor = tinyPool || c.floors.softFloor
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
    requiredOverflow: requiredCount > ROOM_CAP, // R10 soft cap — warning only, never a demotion
  }
}
