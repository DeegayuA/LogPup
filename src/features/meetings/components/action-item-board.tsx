'use client'

// The ONE implementation of "edit this action item": the row-level editing
// controls (reassign, reschedule, retitle), the accept/dismiss/undo mutation
// logic, and the two card layouts (auto-assigned, suggested) that render a
// `meeting_task_suggestions` row. Shared between note-timeline.tsx's Record
// panel (comfortable density, full detail) and meeting-notes.tsx's Action
// items panel (compact density, dense list) — see the doc comment on
// ActionItemSuggestionsList for why this exists as a shared file instead of
// two copies of the same controls.
//
// Each caller keeps its OWN data ownership (NoteTimeline already fetches
// segments+suggestions together via getMeetingNoteTimeline; the Action items
// panel gets suggestions bundled into getMeetingIntel, which it already
// fetches for the rest of the write-up) — this file owns only the shared
// mutation logic (useActionItemActions) and the shared rendering
// (ActionItemSuggestionsList), driven by whatever list+setter+reload the
// caller hands it.

import { useState, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { CheckIcon, Loader2Icon, PencilIcon, SparklesIcon, UndoIcon, XIcon } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { DateTimeWheelField, roundUpToStep } from '@/components/ui/datetime-wheel'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { MentionUser } from '@/components/mention-textarea'
import { cn } from '@/lib/utils'
import { bilingualText, MetaChip, SectionHeading } from '@/features/meetings/components/meeting-chips'
import {
  buildSuggestionUpdatePayload,
  buildTaskUpdatePayload,
  classifyDueDateInput,
  findDueDateHint,
  resolveActionItemEditTarget,
  type ActionItemEditPatch,
  type DeadlineHintSource,
} from '@/features/meetings/components/note-timeline-model'
import {
  acceptTaskSuggestion,
  dismissTaskSuggestion,
  undoAutoAcceptedSuggestion,
  updateTaskSuggestion,
  type TaskSuggestionView,
} from '@/features/meetings/ai-actions'
import { updateTask } from '@/features/sprints/task-actions'
import type { AttendeeRef } from '@/features/meetings/followups'

export const UNASSIGNED = '__unassigned__'

export const PRIORITY_OPTIONS = [
  { value: '0', label: 'None' },
  { value: '1', label: 'Low' },
  { value: '2', label: 'Medium' },
  { value: '3', label: 'High' },
]

type EditForm = { title: string; assigneeId: string; dueDate: string; priority: string }

function toEditForm(suggestion: TaskSuggestionView): EditForm {
  return {
    title: suggestion.text,
    assigneeId: suggestion.suggestedUserId ?? UNASSIGNED,
    dueDate: suggestion.suggestedDueDate ?? '',
    priority: '0',
  }
}

/**
 * Meeting attendees first, then any other approved active user in the wider
 * mention pool — deduped so an attendee who is also in `mentionUsers` (the
 * common case) is not offered twice in the assignee picker. One
 * implementation shared by every caller instead of each re-deriving it.
 */
export function buildAssigneePool(attendees: AttendeeRef[], mentionUsers?: MentionUser[]): MentionUser[] {
  const pool = mentionUsers ?? attendees
  return [...attendees, ...pool.filter((person) => !attendees.some((attendee) => attendee.id === person.id))]
}

/**
 * Applies an inline edit's patch to a row's CLIENT-side view immediately,
 * ahead of the server round trip — see useActionItemActions.
 * handleActionItemEdit. Title lands on `taskTitle` for an already-accepted
 * (auto-assigned) row, since that is what the card actually renders once a
 * task exists; `text` for an open suggestion. `assigneePool` resolves an
 * assignee id back to the display name this UI shows, without waiting on the
 * server to hand it back.
 */
function applyOptimisticActionItemPatch(
  suggestion: TaskSuggestionView,
  patch: ActionItemEditPatch,
  assigneePool: MentionUser[],
): TaskSuggestionView {
  const next = { ...suggestion }
  const isTask = suggestion.status === 'accepted' && suggestion.createdTaskId !== null
  if (patch.title !== undefined) {
    if (isTask) next.taskTitle = patch.title
    else next.text = patch.title
  }
  if (patch.assigneeId !== undefined) {
    next.suggestedUserId = patch.assigneeId
    next.suggestedUserName = patch.assigneeId
      ? (assigneePool.find((p) => p.id === patch.assigneeId)?.name ?? null)
      : null
  }
  if (patch.dueDate !== undefined) {
    next.suggestedDueDate = patch.dueDate
  }
  return next
}

/* --- inline editors for a live action-item row (suggestion or task) -----
 *
 * These three are the "can edit people, assign" feature: reassign,
 * reschedule or retitle a row without leaving the write-up, wherever it
 * appears. Which record an edit actually writes to (the open suggestion, or
 * the task it already became) is resolveActionItemEditTarget's job — these
 * components only ever emit a patch; useActionItemActions.handleActionItemEdit
 * does the routing. */

/** One person's initial, for the assignee trigger's avatar — no avatarUrl is
 *  threaded down this far (attendees/mentionUsers are both {id, name}), so
 *  this is deliberately initials-only rather than a broken image request. */
function PersonInitial({ name }: { name: string | null }) {
  return (
    <Avatar size="sm" className="size-5">
      <AvatarFallback className="text-2xs">{name ? name.slice(0, 1).toUpperCase() : '?'}</AvatarFallback>
    </Avatar>
  )
}

/**
 * Click the assigned person to reassign — a Select over the meeting's
 * attendees first, then any other approved active user (see `people` at the
 * call site), with an explicit "Nobody / unassigned" option so clearing an
 * assignment is never a special case. Shows the name (and an initials
 * avatar), never a raw id.
 */
function ActionItemAssignee({
  currentId,
  currentName,
  people,
  disabled,
  onChange,
  label,
}: {
  currentId: string | null
  currentName: string | null
  people: MentionUser[]
  disabled: boolean
  onChange: (id: string | null) => void
  label: string
}) {
  return (
    <Select
      value={currentId ?? UNASSIGNED}
      onValueChange={(v) => v && onChange(v === UNASSIGNED ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger size="sm" className="h-auto gap-1.5 border-transparent bg-transparent px-1 py-0.5 hover:border-border hover:bg-muted/50" aria-label={label}>
        <SelectValue>
          {() => (
            <span className="inline-flex items-center gap-1.5">
              <PersonInitial name={currentName} />
              <span className="text-xs font-medium">{currentName ?? 'Unassigned'}</span>
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED}>Nobody / unassigned</SelectItem>
        {people.map((person) => (
          <SelectItem key={person.id} value={person.id}>
            {person.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * Click the due chip to set/change/clear it, via the same DateTimeWheelField
 * every other date+time picker in this codebase uses — no second picker
 * built for this one spot.
 *
 * Three distinct things this can show, and they must never be confused with
 * one another:
 *  - a REAL due date (suggestedDueDate/dueDate actually stored) — the
 *    ordinary chip, dates only, no fabricated urgency.
 *  - an UNRESOLVED HINT — the model wrote a due-date phrase for this same
 *    item elsewhere in its write-up (see findDueDateHint) that never
 *    resolved to a real date ("Today at 4:30 PM, 5:00 PM, or 5:50 PM" is
 *    three candidate times, not a timestamp) — shown as a quoted hint the
 *    user can turn into a real date with one click, never rendered as if it
 *    were itself a deadline.
 *  - a RESOLVED HINT — same idea, but the phrase WAS a real date in a format
 *    normalizeDueDate's strict-ISO rule rejected ("August 20, 2026") — shown
 *    pre-filled so confirming it is one click, not a re-type.
 *  - nothing at all — a plain, clearly-labeled "No due date".
 */
function ActionItemDueDate({
  id,
  currentIso,
  hint,
  disabled,
  onSave,
  label,
}: {
  /** A DOM-id-safe key (the row's suggestion id) — kept separate from
   *  `label`, which is human-readable text (spaces, quotes) and unsafe to
   *  use as an element id. */
  id: string
  currentIso: string | null
  hint: string | null
  disabled: boolean
  onSave: (iso: string | null) => void
  label: string
}) {
  const [editing, setEditing] = useState(false)
  const currentDate = currentIso ? parseISO(currentIso) : null
  const [pending, setPending] = useState<Date>(currentDate ?? roundUpToStep(new Date()))

  function openEditor(seed: Date | null) {
    setPending(seed ?? currentDate ?? roundUpToStep(new Date()))
    setEditing(true)
  }

  function commit() {
    onSave(format(pending, 'yyyy-MM-dd'))
    setEditing(false)
  }

  if (editing) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <DateTimeWheelField id={`due-${id}`} label="Due date" value={pending} onChange={setPending} className="w-56" />
        <Button size="icon-sm" type="button" onClick={commit}>
          <CheckIcon aria-hidden />
          <span className="sr-only">Save due date</span>
        </Button>
        {currentIso ? (
          <Button
            size="icon-sm"
            variant="ghost"
            type="button"
            onClick={() => {
              onSave(null)
              setEditing(false)
            }}
          >
            <XIcon aria-hidden />
            <span className="sr-only">Clear due date</span>
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </span>
    )
  }

  const triggerClass =
    'rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-60'

  if (currentDate) {
    return (
      <button type="button" disabled={disabled} onClick={() => openEditor(null)} className={triggerClass} aria-label={`${label} — click to change`}>
        <MetaChip>
          Due <span className="font-mono tabular-nums">{format(currentDate, 'MMM d')}</span>
        </MetaChip>
      </button>
    )
  }

  if (hint) {
    const classified = classifyDueDateInput(hint)
    if (classified.kind === 'resolved') {
      const resolvedDate = parseISO(classified.iso)
      return (
        <button
          type="button"
          disabled={disabled}
          onClick={() => openEditor(resolvedDate)}
          className={triggerClass}
          aria-label={`${label} — the write-up said "${hint}", click to confirm ${format(resolvedDate, 'MMM d')}`}
        >
          <MetaChip tone="warning">
            Hint <span className="font-mono tabular-nums">{format(resolvedDate, 'MMM d')}</span>
          </MetaChip>
        </button>
      )
    }
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => openEditor(null)}
        className={triggerClass}
        aria-label={`${label} — unresolved hint from the write-up: "${classified.raw}", not a real date. Click to set one.`}
      >
        <MetaChip tone="warning">Unresolved: &ldquo;{classified.raw}&rdquo;</MetaChip>
      </button>
    )
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => openEditor(null)}
      className={cn(triggerClass, 'text-xs text-muted-foreground italic hover:text-foreground')}
      aria-label={`${label} — no due date, click to set one`}
    >
      No due date
    </button>
  )
}

/**
 * Click the title to edit it — same save-on-blur-or-Enter, revert-on-Escape
 * shape as the admin table's PhoneCell/PersonalEmailCell, adapted to a
 * click-to-reveal control (rather than an always-visible input) so a row of
 * chips doesn't turn into a permanent text box.
 */
function ActionItemTitle({
  value,
  disabled,
  onSave,
  ariaLabel,
  display,
}: {
  value: string
  disabled: boolean
  onSave: (next: string) => void
  ariaLabel: string
  /**
   * What to show when NOT editing, if it needs to be more than plain text —
   * the auto-assigned card links its title to the task's board, and that
   * link has to survive editing being added beside it rather than being
   * replaced by a bare click-to-edit span (the two affordances would fight
   * over the same click otherwise). Defaults to plain text.
   */
  display?: ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          setEditing(false)
          const next = draft.trim()
          if (next && next !== value) onSave(next)
          else setDraft(value)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            event.currentTarget.blur()
          }
          if (event.key === 'Escape') {
            setDraft(value)
            setEditing(false)
          }
        }}
        minLength={1}
        maxLength={140}
        aria-label={ariaLabel}
        // Sized by WIDTH, not flex basis: both call sites mount this inside a
        // `flex-col` card column, where `basis-48` is read along the column's
        // main axis — i.e. a 12rem minimum HEIGHT — which is what padded every
        // action-item card with ~190px of blank space under its title.
        className="h-auto w-full min-w-0 py-0.5 text-sm"
      />
    )
  }

  return (
    <span className="flex w-full min-w-0 items-start gap-1">
      <span className="min-w-0 flex-1">
        {display ?? <span className={cn(bilingualText, 'text-foreground')}>{value}</span>}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        type="button"
        disabled={disabled}
        onClick={() => {
          setDraft(value)
          setEditing(true)
        }}
      >
        <PencilIcon aria-hidden />
        <span className="sr-only">{ariaLabel}</span>
      </Button>
    </span>
  )
}

/**
 * The mutation logic behind every action-item edit, wherever it renders.
 * Callers keep their OWN copy of `suggestions` (NoteTimeline's full
 * NoteTimelineData, or the Action items panel's slice of MeetingIntel) — this
 * hook never owns that state itself, only reads the current list and asks the
 * caller to replace it via `setSuggestions`, so it works identically against
 * either data source. `reload` is what accept/dismiss/undo call on success
 * (matching this codebase's existing convention of a full refetch rather than
 * reconstructing derived server state locally); only the inline
 * assignee/due-date/title edit optimistically patches `suggestions` directly,
 * with a snapshot revert on failure.
 *
 * Per-row pending state (never a list-wide lock) for every mutation, same
 * discipline note-timeline.tsx already had — busy ids are keyed by
 * suggestion.id so editing one row never reads as "busy" for another.
 */
export function useActionItemActions(
  suggestions: TaskSuggestionView[],
  setSuggestions: (updater: (prev: TaskSuggestionView[]) => TaskSuggestionView[]) => void,
  reload: () => Promise<void>,
  assigneePool: MentionUser[],
) {
  const [suggestionBusyId, setSuggestionBusyId] = useState<string | null>(null)
  const [suggestionPending, startSuggestionPending] = useTransition()

  const [undoBusyId, setUndoBusyId] = useState<string | null>(null)
  const [undoPending, startUndoPending] = useTransition()

  const [actionEditBusyId, setActionEditBusyId] = useState<string | null>(null)
  const [actionEditPending, startActionEditPending] = useTransition()

  const [editingSuggestion, setEditingSuggestion] = useState<TaskSuggestionView | null>(null)
  const [suggestionForm, setSuggestionForm] = useState<EditForm | null>(null)

  /**
   * One inline edit to one action-item row. Routes to the suggestion or the
   * task it already became (resolveActionItemEditTarget) — never both, and
   * never bypassing updateTask's own authz for the already-a-task case (see
   * that function's own comment on why). Optimistic: the row updates
   * immediately from `patch`; a failure reverts to the pre-edit snapshot and
   * reports why.
   */
  function handleActionItemEdit(suggestion: TaskSuggestionView, patch: ActionItemEditPatch) {
    const target = resolveActionItemEditTarget(suggestion)
    if (!target) {
      toast.error('This item can no longer be edited')
      return
    }
    const snapshot = suggestions
    setSuggestions(() =>
      suggestions.map((row) =>
        row.id === suggestion.id ? applyOptimisticActionItemPatch(row, patch, assigneePool) : row,
      ),
    )
    setActionEditBusyId(suggestion.id)
    startActionEditPending(async () => {
      try {
        const res =
          target.kind === 'suggestion'
            ? await updateTaskSuggestion(target.id, buildSuggestionUpdatePayload(patch))
            : await updateTask(target.id, buildTaskUpdatePayload(patch))
        if (!res.ok) {
          toast.error(res.error)
          setSuggestions(() => snapshot)
          return
        }
      } catch {
        toast.error('Something went wrong — try again')
        setSuggestions(() => snapshot)
      } finally {
        setActionEditBusyId(null)
      }
    })
  }

  function handleAcceptSuggestion(suggestion: TaskSuggestionView, overrides?: EditForm) {
    setSuggestionBusyId(suggestion.id)
    startSuggestionPending(async () => {
      try {
        const res = await acceptTaskSuggestion(
          suggestion.id,
          overrides
            ? {
                title: overrides.title.trim() || undefined,
                assigneeId: overrides.assigneeId === UNASSIGNED ? null : overrides.assigneeId,
                dueDate: overrides.dueDate || null,
                priority: Number(overrides.priority),
              }
            : undefined,
        )
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Task created')
        setEditingSuggestion(null)
        setSuggestionForm(null)
        await reload()
      } catch {
        toast.error('Something went wrong — try again')
      } finally {
        setSuggestionBusyId(null)
      }
    })
  }

  // Layer (b) of full-auto's manual override: undo deletes the task the
  // auto pass created and reverts the card to a plain manual suggestion.
  // The server re-checks the todo+unmodified constraint (canUndoAutoAssign)
  // regardless of what this button shows — a failure here just means
  // someone (or something) changed the task between load and click.
  function handleUndoAutoAssign(suggestionId: string) {
    setUndoBusyId(suggestionId)
    startUndoPending(async () => {
      try {
        const res = await undoAutoAcceptedSuggestion(suggestionId)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Undone — back to a suggestion card')
        await reload()
      } catch {
        toast.error('Something went wrong — try again')
      } finally {
        setUndoBusyId(null)
      }
    })
  }

  function handleDismissSuggestion(suggestionId: string) {
    setSuggestionBusyId(suggestionId)
    startSuggestionPending(async () => {
      try {
        const res = await dismissTaskSuggestion(suggestionId)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        await reload()
      } catch {
        toast.error('Something went wrong — try again')
      } finally {
        setSuggestionBusyId(null)
      }
    })
  }

  return {
    suggestionBusyId,
    suggestionPending,
    undoBusyId,
    undoPending,
    actionEditBusyId,
    actionEditPending,
    editingSuggestion,
    setEditingSuggestion,
    suggestionForm,
    setSuggestionForm,
    handleActionItemEdit,
    handleAcceptSuggestion,
    handleUndoAutoAssign,
    handleDismissSuggestion,
  }
}

export type ActionItemActions = ReturnType<typeof useActionItemActions>

function AutoAssignedActionCard({
  suggestion,
  compact,
  canManage,
  assigneePool,
  deadlines,
  actions,
}: {
  suggestion: TaskSuggestionView
  compact: boolean
  canManage: boolean
  assigneePool: MentionUser[]
  deadlines: DeadlineHintSource[]
  actions: ActionItemActions
}) {
  const busy = actions.undoBusyId === suggestion.id && actions.undoPending
  const editBusy = actions.actionEditBusyId === suggestion.id && actions.actionEditPending
  const rowDisabled = busy || editBusy
  const titleText = suggestion.taskTitle ?? suggestion.text
  const linkedTitle =
    suggestion.appSlug && suggestion.createdTaskId ? (
      <Link
        href={`/apps/${suggestion.appSlug}`}
        className={cn(
          bilingualText,
          'text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        )}
      >
        {titleText}
      </Link>
    ) : (
      <p className={cn(bilingualText, 'text-foreground')}>{titleText}</p>
    )

  return (
    <li
      className={cn(
        'flex flex-wrap items-start justify-between gap-2 rounded-lg border border-success/30 bg-success/5',
        compact ? 'p-2' : 'p-2.5',
      )}
    >
      <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
        {canManage ? (
          <ActionItemTitle
            value={titleText}
            display={linkedTitle}
            disabled={rowDisabled}
            onSave={(next) => actions.handleActionItemEdit(suggestion, { title: next })}
            ariaLabel={`Edit title: ${titleText}`}
          />
        ) : (
          linkedTitle
        )}
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {/* Sparkles = AI acted; check = the outcome was committed, not
              merely proposed — together they say "done automatically",
              distinct from the neutral "Suggested" chip on a card nobody
              clicked yet. */}
          <MetaChip tone="success">
            <SparklesIcon className="size-3.5 shrink-0" aria-hidden />
            <CheckIcon className="size-3.5 shrink-0" aria-hidden />
            Auto-assigned
          </MetaChip>
          {canManage ? (
            <span className="inline-flex items-center gap-1">
              to
              <ActionItemAssignee
                currentId={suggestion.suggestedUserId}
                currentName={suggestion.suggestedUserName}
                people={assigneePool}
                disabled={rowDisabled}
                onChange={(id) => actions.handleActionItemEdit(suggestion, { assigneeId: id })}
                label={`Reassign "${titleText}"`}
              />
            </span>
          ) : suggestion.suggestedUserId ? (
            <>
              to{' '}
              <Link
                href={`/people/${suggestion.suggestedUserId}`}
                className="font-medium text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {suggestion.suggestedUserName ?? 'Unknown'}
              </Link>
            </>
          ) : null}
          {canManage ? (
            <ActionItemDueDate
              id={suggestion.id}
              currentIso={suggestion.suggestedDueDate}
              hint={suggestion.suggestedDueDate ? null : findDueDateHint(suggestion.text, deadlines)}
              disabled={rowDisabled}
              onSave={(iso) => actions.handleActionItemEdit(suggestion, { dueDate: iso })}
              label={`Due date for "${titleText}"`}
            />
          ) : suggestion.suggestedDueDate ? (
            <span className="font-mono">Due {format(parseISO(suggestion.suggestedDueDate), 'MMM d')}</span>
          ) : null}
        </p>
      </div>
      {canManage ? (
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            type="button"
            disabled={rowDisabled}
            onClick={() => actions.handleUndoAutoAssign(suggestion.id)}
          >
            {busy ? <Loader2Icon className="animate-spin" aria-hidden /> : <UndoIcon aria-hidden />}
            Undo
          </Button>
        </div>
      ) : null}
    </li>
  )
}

function SuggestedActionCard({
  suggestion,
  compact,
  canManage,
  assigneePool,
  appIds,
  deadlines,
  actions,
}: {
  suggestion: TaskSuggestionView
  compact: boolean
  canManage: boolean
  assigneePool: MentionUser[]
  /** The meeting's projects — a set, none primary; `[]` is the app-less meeting. */
  appIds: string[]
  deadlines: DeadlineHintSource[]
  actions: ActionItemActions
}) {
  const busy = actions.suggestionBusyId === suggestion.id && actions.suggestionPending
  const editBusy = actions.actionEditBusyId === suggestion.id && actions.actionEditPending
  const rowDisabled = busy || editBusy

  return (
    <li
      className={cn(
        'flex flex-wrap items-start justify-between gap-2 rounded-lg border border-dashed border-border bg-card',
        compact ? 'p-2' : 'p-2.5',
      )}
    >
      <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
        {canManage ? (
          <ActionItemTitle
            value={suggestion.text}
            disabled={rowDisabled}
            onSave={(next) => actions.handleActionItemEdit(suggestion, { title: next })}
            ariaLabel={`Edit title: ${suggestion.text}`}
          />
        ) : (
          <p className={cn(bilingualText, 'text-foreground')}>{suggestion.text}</p>
        )}
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <MetaChip>Suggested</MetaChip>
          {suggestion.suggestedAppName ? (
            // Where this task will actually be filed — the AI's routing
            // decision (suggestedAppId, ai-actions.ts). Without this label,
            // accepting a routed suggestion files it into an app the card
            // never named.
            <MetaChip>→ {suggestion.suggestedAppName}</MetaChip>
          ) : null}
          {canManage ? (
            <ActionItemAssignee
              currentId={suggestion.suggestedUserId}
              currentName={suggestion.suggestedUserName}
              people={assigneePool}
              disabled={rowDisabled}
              onChange={(id) => actions.handleActionItemEdit(suggestion, { assigneeId: id })}
              label={`Assignee for "${suggestion.text}"`}
            />
          ) : (
            <span>{suggestion.suggestedUserName ?? 'Unassigned'}</span>
          )}
          {canManage ? (
            <ActionItemDueDate
              id={suggestion.id}
              currentIso={suggestion.suggestedDueDate}
              hint={suggestion.suggestedDueDate ? null : findDueDateHint(suggestion.text, deadlines)}
              disabled={rowDisabled}
              onSave={(iso) => actions.handleActionItemEdit(suggestion, { dueDate: iso })}
              label={`Due date for "${suggestion.text}"`}
            />
          ) : suggestion.suggestedDueDate ? (
            <span className="font-mono">Due {format(parseISO(suggestion.suggestedDueDate), 'MMM d')}</span>
          ) : null}
        </p>
      </div>
      {canManage ? (
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            type="button"
            // A suggestion the AI routed to a specific app can be accepted
            // even when the MEETING is on no project — the server files it
            // into suggestion.suggestedAppId (acceptTaskSuggestion falls back
            // to the meeting's own project only when routing was
            // inconclusive). Gating on the meeting's projects alone made
            // routed suggestions unclickable exactly where routing matters
            // most.
            //
            // `appIds.length === 0` is the app-less meeting — the same state
            // the old null appId meant, and the ONLY one where the server has
            // nowhere to file an unrouted item. A meeting on two projects is
            // NOT that state: the fallback lands on a project the meeting is
            // genuinely on (see the mirror note on meetings.app_id in
            // src/db/schema.ts), so the button stays live.
            disabled={rowDisabled || (appIds.length === 0 && !suggestion.suggestedAppId)}
            title={
              appIds.length > 0 || suggestion.suggestedAppId
                ? undefined
                // "app", not "project": the control that fixes this is
                // labelled "Apps" (meeting-project-select.tsx), and a hint may
                // not name a control the viewer cannot find.
                : 'Link this meeting to an app first'
            }
            onClick={() => actions.handleAcceptSuggestion(suggestion)}
          >
            {busy ? <Loader2Icon className="animate-spin" aria-hidden /> : <CheckIcon aria-hidden />}
            Add task
          </Button>
          {!compact ? (
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={rowDisabled}
              onClick={() => {
                actions.setEditingSuggestion(suggestion)
                actions.setSuggestionForm(toEditForm(suggestion))
              }}
            >
              <PencilIcon aria-hidden /> Edit &amp; add
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            disabled={rowDisabled}
            onClick={() => actions.handleDismissSuggestion(suggestion.id)}
          >
            <XIcon aria-hidden />
            <span className="sr-only">Dismiss suggestion</span>
          </Button>
        </div>
      ) : null}
    </li>
  )
}

/**
 * Renders a meeting's task suggestions as "Auto-assigned" and "Suggested
 * tasks" sections — the shared list both note-timeline.tsx's Record panel
 * and meeting-notes.tsx's Action items panel mount, so there is exactly one
 * place that assembles a suggestion row out of the shared editing controls
 * above. `compact` trims card padding and drops the "Edit & add" dialog
 * trigger (inline editing of assignee/due date/title already covers what
 * that dialog offers, minus a priority field the dense list has no room
 * for) — everything else, including the Dialog itself, renders identically
 * at both densities.
 *
 * Returns null when there is nothing to show — callers decide what THAT
 * means for their own empty state (the write-up panel has a designed
 * empty-filter state; the Record panel's own segments/composer below simply
 * continue without this section).
 */
export function ActionItemSuggestionsList({
  suggestions,
  attendees,
  mentionUsers,
  appIds,
  meetingTitle,
  deadlines,
  canManage,
  compact = false,
  autoAssignCappedCount = 0,
  actions,
}: {
  suggestions: TaskSuggestionView[]
  attendees: AttendeeRef[]
  mentionUsers?: MentionUser[]
  /** The meeting's projects — a set, none primary; `[]` is the app-less meeting. */
  appIds: string[]
  meetingTitle: string
  deadlines: DeadlineHintSource[]
  canManage: boolean
  compact?: boolean
  autoAssignCappedCount?: number
  actions: ActionItemActions
}) {
  const assigneePool = buildAssigneePool(attendees, mentionUsers)

  // getMeetingIntel/getMeetingNoteTimeline already narrow `suggestions` to
  // open + auto-accepted (see fetchTaskSuggestions's query comment) — this
  // just tells the two apart for rendering. A suggestion a PERSON accepted
  // has already dropped off the list entirely, same as it always has.
  const autoSuggestions = suggestions.filter((s) => s.status === 'accepted')
  const manualSuggestions = suggestions.filter((s) => s.status === 'open')

  if (autoSuggestions.length === 0 && manualSuggestions.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      {autoSuggestions.length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionHeading as="h5" icon={SparklesIcon} title="Auto-assigned" count={autoSuggestions.length} />
          <ul className="flex flex-col gap-2">
            {autoSuggestions.map((suggestion) => (
              <AutoAssignedActionCard
                key={suggestion.id}
                suggestion={suggestion}
                compact={compact}
                canManage={canManage}
                assigneePool={assigneePool}
                deadlines={deadlines}
                actions={actions}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {manualSuggestions.length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionHeading as="h5" icon={SparklesIcon} title="Suggested tasks" count={manualSuggestions.length} />
          {autoAssignCappedCount > 0 ? (
            <p className="text-2xs text-muted-foreground">
              <span className="font-mono">{autoAssignCappedCount}</span>{' '}
              {autoAssignCappedCount === 1 ? 'more suggestion needs' : 'more suggestions need'} review — this
              meeting already hit its auto-assign limit.
            </p>
          ) : null}
          <ul className="flex flex-col gap-2">
            {manualSuggestions.map((suggestion) => (
              <SuggestedActionCard
                key={suggestion.id}
                suggestion={suggestion}
                compact={compact}
                canManage={canManage}
                assigneePool={assigneePool}
                appIds={appIds}
                deadlines={deadlines}
                actions={actions}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <Dialog
        open={actions.editingSuggestion !== null}
        onOpenChange={(open) => {
          if (!open) {
            actions.setEditingSuggestion(null)
            actions.setSuggestionForm(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit suggested task</DialogTitle>
            <DialogDescription>From “{meetingTitle}” — adjust before creating it.</DialogDescription>
          </DialogHeader>
          {actions.editingSuggestion && actions.suggestionForm ? (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault()
                if (actions.editingSuggestion && actions.suggestionForm) {
                  actions.handleAcceptSuggestion(actions.editingSuggestion, actions.suggestionForm)
                }
              }}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="suggestion-title">Title</Label>
                <Input
                  id="suggestion-title"
                  value={actions.suggestionForm.title}
                  onChange={(e) =>
                    actions.setSuggestionForm((f) => (f ? { ...f, title: e.target.value } : f))
                  }
                  minLength={1}
                  maxLength={140}
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="suggestion-assignee">Assignee</Label>
                  <Select
                    value={actions.suggestionForm.assigneeId}
                    onValueChange={(v) =>
                      actions.setSuggestionForm((f) => (f ? { ...f, assigneeId: v ?? UNASSIGNED } : f))
                    }
                  >
                    <SelectTrigger id="suggestion-assignee" className="w-full">
                      <SelectValue>
                        {(value: string) =>
                          value === UNASSIGNED
                            ? 'Unassigned'
                            : (attendees.find((a) => a.id === value)?.name ?? 'Unassigned')
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                      {attendees.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="suggestion-priority">Priority</Label>
                  <Select
                    value={actions.suggestionForm.priority}
                    onValueChange={(v) =>
                      actions.setSuggestionForm((f) => (f ? { ...f, priority: v ?? '0' } : f))
                    }
                  >
                    <SelectTrigger id="suggestion-priority" className="w-full">
                      <SelectValue>
                        {(value: string) => PRIORITY_OPTIONS.find((opt) => opt.value === value)?.label ?? 'None'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="suggestion-due">Due date</Label>
                <Input
                  id="suggestion-due"
                  type="date"
                  value={actions.suggestionForm.dueDate}
                  onChange={(e) =>
                    actions.setSuggestionForm((f) => (f ? { ...f, dueDate: e.target.value } : f))
                  }
                  className="font-mono"
                />
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={actions.suggestionBusyId === actions.editingSuggestion.id && actions.suggestionPending}
                >
                  {actions.suggestionBusyId === actions.editingSuggestion.id && actions.suggestionPending
                    ? 'Creating…'
                    : 'Create task'}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export type { EditForm }
