// What to suggest a person write about their day, ordered by what their role
// on those projects actually makes their day about.
//
// The premise, from the studio: a tech lead's day is meetings, interviews and
// unblocking people — not tickets moved. An engineer's day on the same project
// is the opposite. Suggesting "you closed 3 tasks" to someone who spent the day
// in reviews is not merely unhelpful; it teaches them the suggestions do not
// know what they do, and they stop reading them.
//
// Role is PER PROJECT, never per person. Somebody can lead Kestrel and write
// code on Apollo in the same afternoon, and project-roles.ts already derives
// that from the free text in assignments.role — this file adds no second
// opinion about who counts as a lead.
//
// EVERY SUGGESTION IS EVIDENCE. A meeting they attended, a task the activity
// log shows them touching. Nothing here invents an activity, because the note
// is a first-person statement and a suggestion that fabricates a plausible day
// is a suggestion that gets accepted unread.

import type { ProjectRoleTone } from '@/lib/project-roles'

export type SuggestionSource = 'meeting' | 'task'

export type SuggestionInput = {
  meetings: { title: string; minutes: number | null; appName: string | null }[]
  /** Tasks the activity log shows them demonstrably touching that day. */
  tasksTouched: { id: string; title: string; appName: string | null }[]
  /** This person's role on each project, keyed by project NAME. */
  roleByApp: ReadonlyMap<string, ProjectRoleTone>
}

export type EntrySuggestion = {
  key: string
  /**
   * Ready to insert as-is, already carrying the `[Project Name]` tag the note
   * convention uses — so an accepted suggestion renders as a linked pill
   * rather than as something the person has to tag by hand afterwards.
   */
  text: string
  source: SuggestionSource
  appName: string | null
  role: ProjectRoleTone | null
  minutes: number | null
}

/**
 * Whether this person's day on this project is about running/reviewing rather
 * than building. Managers and reviewers both lead the ordering; the studio's
 * own rule is that a lead or architect is a busy REVIEWER, not an admin, but
 * for "what did your day consist of" both answer meetings-and-people.
 */
function leadsRatherThanBuilds(role: ProjectRoleTone | null): boolean {
  return role === 'manager' || role === 'reviewer'
}

export function buildEntrySuggestions(input: SuggestionInput): EntrySuggestion[] {
  const roleFor = (appName: string | null): ProjectRoleTone | null =>
    appName ? (input.roleByApp.get(appName) ?? null) : null

  const fromMeetings: EntrySuggestion[] = input.meetings.map((m) => ({
    key: `meeting:${m.title}:${m.appName ?? ''}`,
    text: withTag(m.minutes === null ? m.title : `${m.title} (${m.minutes} min)`, m.appName),
    source: 'meeting' as const,
    appName: m.appName,
    role: roleFor(m.appName),
    minutes: m.minutes,
  }))

  const fromTasks: EntrySuggestion[] = input.tasksTouched.map((t) => ({
    key: `task:${t.id}`,
    text: withTag(t.title, t.appName),
    source: 'task' as const,
    appName: t.appName,
    role: roleFor(t.appName),
    minutes: null,
  }))

  const all = dedupe([...fromMeetings, ...fromTasks])

  // THE ORDERING IS THE FEATURE. A minutes-first sort would be role-blind and
  // would reproduce this order on most days by coincidence — meetings usually
  // carry a duration and tasks do not. The discriminating case is a person who
  // LEADS a project: their meeting outranks their task even when the sort has
  // nothing else to go on. entry-suggestions.test.ts pins exactly that case,
  // because a test built from a natural-looking day cannot tell the two apart.
  return all.sort((a, b) => {
    const aLeads = leadsRatherThanBuilds(a.role)
    const bLeads = leadsRatherThanBuilds(b.role)
    if (aLeads !== bLeads) return aLeads ? -1 : 1

    // Within one role band, what the role is about comes first.
    const aFirst = aLeads ? 'meeting' : 'task'
    if (a.source !== b.source) return a.source === aFirst ? -1 : 1

    if ((b.minutes ?? 0) !== (a.minutes ?? 0)) return (b.minutes ?? 0) - (a.minutes ?? 0)
    return a.text.localeCompare(b.text)
  })
}

/** Append the project tag the note convention uses — see note-app-tags.ts. */
function withTag(text: string, appName: string | null): string {
  return appName ? `${text} [${appName}]` : text
}

/**
 * Two sources can describe the same work — a meeting named after the task it
 * was about. Keyed on the rendered text so the person is never offered the
 * same sentence twice; the first occurrence wins, which after the map above
 * means the meeting keeps its duration.
 */
function dedupe(items: EntrySuggestion[]): EntrySuggestion[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const k = item.text.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
