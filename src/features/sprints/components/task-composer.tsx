'use client'

import { useId, useMemo, useState, useTransition, type ClipboardEvent, type KeyboardEvent } from 'react'
import { format } from 'date-fns'
import {
  CalendarDays,
  CornerDownLeft,
  Flag,
  Loader2,
  Sparkles,
  Text as TextIcon,
  UserRound,
  UserRoundPlus,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { createTask } from '@/features/sprints/task-actions'
import { draftTasksFromPaste } from '@/features/sprints/paste-actions'
import {
  meterOrigin,
  useAiMeter,
  type MeterOriginSource,
} from '@/features/gemini/components/ai-meter-provider'
import { planFor } from '@/features/sprints/composer-plan'
import {
  MAX_PASTE_TASKS,
  isBulkPaste,
  splitPasteLocally,
  type PastedTaskDraft,
} from '@/features/sprints/paste-plan'
import type { IntentPerson } from '@/lib/task-intent'
import { PRIORITY_LABEL, type GroupPatch } from '@/features/sprints/board-view'

type PasteRow = PastedTaskDraft & { key: string; include: boolean }

type PasteState = {
  /** The paste verbatim — what "Draft tasks with AI" re-reads as prose. */
  raw: string
  /** 'lines': the free local per-line parse. 'ai': Gemini's restructuring. */
  source: 'lines' | 'ai'
  /** True when the paste had more lines than MAX_PASTE_TASKS — said out
   *  loud in the panel rather than silently dropping the tail. */
  truncated: boolean
  rows: PasteRow[]
}

function toRows(drafts: PastedTaskDraft[]): PasteRow[] {
  return drafts.map((draft, index) => ({ ...draft, key: `row-${index}`, include: true }))
}

/** Same noon-anchored calendar-day rule as the task card. */
function shortDue(iso: string): string {
  return format(new Date(`${iso}T12:00:00`), 'MMM d')
}

/**
 * The inline "Add a task, or a sentence…" field at the foot of every board column.
 *
 * Enter creates the task; everything above the field is a live, read-only
 * account of how the phrase was understood. The preview is the point: a parser
 * that quietly rewrites what you typed is worse than no parser at all, because
 * you can't tell it happened.
 */
export function TaskComposer({
  patch,
  columnTitle,
  people,
  appId,
  sprintId,
}: {
  /**
   * What this column MEANS, from board-view's `patchForGroup` — the same
   * object a drop into this column would apply. Grouping by assignee and
   * typing into Ada's column therefore creates the task already assigned to
   * Ada, which is the only reading of that gesture that isn't a surprise.
   */
  patch: GroupPatch
  columnTitle: string
  /**
   * Everyone a typed name may resolve to — the whole workspace, not just this
   * app's team.
   *
   * Resolving against the team alone answered "@shanika" with "no one here
   * called shanika", which is false: she exists, she is simply not on this
   * app. That message sends you looking for a typo in a correctly spelled
   * name. `onTeam` keeps the distinction so the preview can say the true
   * thing instead, and the server permits the assignment either way —
   * createTask checks the assignee is a real user, not that they are a member.
   */
  people: { id: string; name: string; onTeam: boolean }[]
  appId: string
  sprintId: string | null
}) {
  const [draft, setDraft] = useState('')
  const [focused, setFocused] = useState(false)
  const [isPending, startTransition] = useTransition()
  /** The bulk-paste review panel. See handlePaste — a multi-line paste never
   *  lands mangled in the single-line input; it opens here for review. */
  const [paste, setPaste] = useState<PasteState | null>(null)
  /** Separate transition so a Gemini round trip never locks the input. */
  const [aiPending, startAiTransition] = useTransition()
  const meter = useAiMeter()
  const [aiError, setAiError] = useState<string | null>(null)
  const previewId = useId()

  const intentPeople = useMemo<IntentPerson[]>(
    () => people.map(({ id, name }) => ({ id, name })),
    [people],
  )
  // Parsed on every keystroke — parseTaskIntent is pure and local, so there is
  // no round trip between typing and seeing what will happen.
  const plan = useMemo(() => planFor(draft, intentPeople, new Date()), [draft, intentPeople])

  const teamIds = useMemo(
    () => new Set(people.filter((person) => person.onTeam).map((person) => person.id)),
    [people],
  )
  const nameById = useMemo(() => new Map(people.map((person) => [person.id, person.name])), [people])

  /** Selected people who aren't on this app — named in the preview, still assigned. */
  const offTeam = useMemo(() => {
    if (!plan) return []
    const teamIds = new Set(people.filter((person) => person.onTeam).map((person) => person.id))
    const selected = plan.assignees.length > 0 ? plan.assignees : plan.assignee ? [plan.assignee] : []
    return selected.filter((person) => !teamIds.has(person.id))
  }, [plan, people])

  function submit() {
    if (!plan || isPending) return

    // Two people, one name: say which two and let the user choose. Guessing
    // here is the one outcome that can't be undone by reading the preview.
    if (plan.ambiguousNames.length > 0) {
      toast.error(
        `“${plan.ambiguousQuery}” could be ${plan.ambiguousNames.join(' or ')} — use a full name`,
      )
      return
    }

    startTransition(async () => {
      try {
        // ONE TASK PER SELECTED PERSON — "@shanika @sam fix login" is two
        // identical tasks with two owners, not one task with a shared owner:
        // the schema has a single assignee, and shared ownership is how work
        // falls between chairs anyway. Each person's copy lives its own life
        // (moved, resolved, reprioritised independently).
        const targets: (IntentPerson | null)[] =
          plan.assignees.length > 0 ? plan.assignees : [null]
        const failed: string[] = []
        for (const person of targets) {
          const res = await createTask({
            appId,
            sprintId,
            title: plan.title,
            // A name typed into the field beats the column's implied assignee:
            // the preview above the input has already said out loud who it
            // resolved to, so honouring the column instead would contradict
            // what the user was just shown.
            assigneeId: person?.id ?? patch.assigneeId ?? null,
            // Same precedence as the assignee: a priority typed into the field
            // was shown in the preview, so it beats the column patch.
            priority: plan.priority ?? patch.priority ?? 0,
            description: plan.description ?? undefined,
            status: patch.status ?? 'todo',
            dueDate: plan.due,
          })
          if (!res.ok) failed.push(person?.name ?? 'unassigned')
        }
        if (failed.length > 0) {
          // Partial success is said out loud — the ones that worked exist.
          toast.error(`Could not create the task for ${failed.join(', ')}`)
          return
        }
        if (targets.length > 1) {
          toast.success(
            `${targets.length} tasks created — one each for ${plan.assignees
              .map((person) => person.name.split(/\s+/)[0])
              .join(', ')}`,
          )
        }
        setDraft('')
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape' && paste) {
      event.preventDefault()
      setPaste(null)
      return
    }
    if (event.key !== 'Enter') return
    event.preventDefault()
    submit()
  }

  /**
   * A bulk paste (a list, or a paragraph of minutes) opens a review panel
   * instead of collapsing into the single-line input. The panel starts from
   * the FREE local per-line parse — planFor per line, instant, no model call
   * — and offers "Draft tasks with AI" for prose the line split reads wrong.
   * Nothing is created until the person presses Add: same trust boundary as
   * every AI assist on this surface (createTask validates as if neither the
   * parser nor the model existed).
   */
  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData('text/plain')
    if (!isBulkPaste(text)) return
    const drafts = splitPasteLocally(text, intentPeople, new Date())
    if (drafts.length === 0) return
    event.preventDefault()
    setAiError(null)
    const lineCount = text.split(/\r?\n/).filter((line) => line.trim().length > 0).length
    setPaste({
      raw: text,
      source: 'lines',
      truncated: lineCount > MAX_PASTE_TASKS,
      rows: toRows(drafts),
    })
  }

  function refineWithAi(source?: MeterOriginSource) {
    // Read before the transition — see meterOrigin's note on currentTarget.
    const origin = meterOrigin(source)
    if (!paste || aiPending || isPending) return
    setAiError(null)
    startAiTransition(async () => {
      try {
        const res = await meter.track('sprint-draft', origin, () =>
          draftTasksFromPaste(paste.raw),
        )
        if (!res.ok) {
          setAiError(res.error)
          return
        }
        setPaste((current) =>
          current ? { ...current, source: 'ai', truncated: false, rows: toRows(res.data) } : current,
        )
      } catch {
        setAiError('Could not draft tasks right now — try again')
      }
    })
  }

  function setRow(key: string, patchRow: Partial<PasteRow>) {
    setPaste((current) =>
      current
        ? {
            ...current,
            rows: current.rows.map((row) => (row.key === key ? { ...row, ...patchRow } : row)),
          }
        : current,
    )
  }

  function createFromPaste() {
    if (!paste || isPending) return
    const rows = paste.rows.filter((row) => row.include && row.title.trim().length > 0)
    if (rows.length === 0) return
    startTransition(async () => {
      try {
        const failed: string[] = []
        for (const row of rows) {
          const res = await createTask({
            appId,
            sprintId,
            title: row.title.trim().slice(0, 140),
            // Same precedence as single-add: a person/priority read out of the
            // pasted text beats the column's implied one.
            assigneeId: row.assigneeId ?? patch.assigneeId ?? null,
            priority: row.priority > 0 ? row.priority : (patch.priority ?? 0),
            description: row.description ?? undefined,
            status: patch.status ?? 'todo',
            dueDate: row.dueDate,
          })
          if (!res.ok) failed.push(row.title)
        }
        if (failed.length > 0) {
          // Partial success is said out loud — the ones that worked exist,
          // and the failed rows stay in the panel to retry or discard.
          toast.error(
            failed.length === rows.length
              ? 'Could not create the tasks — try again'
              : `Created ${rows.length - failed.length}, but not: ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? '…' : ''}`,
          )
          setPaste((current) =>
            current
              ? { ...current, rows: current.rows.filter((row) => !row.include || failed.includes(row.title)) }
              : current,
          )
          return
        }
        toast.success(`${rows.length} ${rows.length === 1 ? 'task' : 'tasks'} added to ${columnTitle}`)
        setPaste(null)
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  const includedCount = paste
    ? paste.rows.filter((row) => row.include && row.title.trim().length > 0).length
    : 0

  return (
    <div className="mt-2 flex flex-col">
      {/* The placeholder still has to say what the field IS — it is the only
          visible label, and a column full of cards makes an unlabelled dashed
          box read as content rather than as an invitation. "or a sentence"
          is the whole hint it can afford at min-w-64: it says a bare title is
          not the only thing accepted, and the focus hint below spells out the
          syntax at the moment somebody is about to type. */}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Add a task, or a sentence…"
        disabled={isPending}
        aria-label={`Add task to ${columnTitle}`}
        aria-describedby={previewId}
        autoComplete="off"
        className="border-dashed bg-transparent shadow-none transition-colors duration-150 hover:border-ring/40 focus-visible:border-solid dark:bg-transparent"
      />
      <div id={previewId} aria-live="polite">
        {plan ? (
          <div
            className={cn(
              'mt-1.5 rounded-md border border-dashed border-input bg-card/60 px-2 py-1.5',
              'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1',
              'motion-safe:duration-150 motion-safe:ease-out',
            )}
          >
            <p className="truncate text-xs font-medium text-foreground">{plan.title}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-muted-foreground">
              {plan.assignees.length > 1 ? (
                // The fan-out, stated before it happens: same task, one copy
                // per named person.
                <span className="inline-flex items-center gap-1 text-foreground">
                  <UserRound className="size-3 shrink-0" aria-hidden />
                  {plan.assignees.length} tasks — one each for{' '}
                  {plan.assignees.map((person) => person.name.split(/\s+/)[0]).join(', ')}
                </span>
              ) : plan.assignee ? (
                <span className="inline-flex items-center gap-1 text-foreground">
                  <UserRound className="size-3 shrink-0" aria-hidden />
                  {plan.assignee.name}
                </span>
              ) : plan.ambiguousNames.length > 0 ? (
                <span className="inline-flex items-center gap-1 text-destructive">
                  <UserRound className="size-3 shrink-0" aria-hidden />
                  {plan.ambiguousNames.join(' or ')}? Use a full name
                </span>
              ) : plan.unresolvedQuery ? (
                <span className="inline-flex items-center gap-1 text-destructive">
                  <UserRound className="size-3 shrink-0" aria-hidden />
                  No one in the workspace called “{plan.unresolvedQuery}” — adding unassigned
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <UserRound className="size-3 shrink-0" aria-hidden />
                  Unassigned
                </span>
              )}
              {/* A real person who simply isn't on this app. Warning tone, not
                  destructive: the task WILL be created and assigned to them —
                  this says the thing worth knowing, rather than the false
                  "no one here called shanika" that resolving against the app
                  team alone used to produce. */}
              {offTeam.length > 0 ? (
                <span className="inline-flex items-center gap-1 text-warning">
                  <UserRoundPlus className="size-3 shrink-0" aria-hidden />
                  {offTeam.map((person) => person.name).join(', ')}
                  {offTeam.length === 1 ? ' is not on this app' : ' are not on this app'}
                </span>
              ) : null}
              {plan.dueLabel ? (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3 shrink-0" aria-hidden />
                  {plan.dueLabel}
                </span>
              ) : null}
              {plan.priorityLabel ? (
                <span className="inline-flex items-center gap-1">
                  <Flag className="size-3 shrink-0" aria-hidden />
                  {plan.priorityLabel}
                </span>
              ) : null}
              {plan.description ? (
                <span className="inline-flex min-w-0 items-center gap-1">
                  <TextIcon className="size-3 shrink-0" aria-hidden />
                  <span className="truncate">{plan.description}</span>
                </span>
              ) : null}
              <span className="ml-auto inline-flex shrink-0 items-center gap-1">
                {isPending ? (
                  <>
                    <Loader2 className="size-3 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
                    Adding…
                  </>
                ) : (
                  <>
                    <CornerDownLeft className="size-3 shrink-0" aria-hidden />
                    to add
                  </>
                )}
              </span>
            </p>
          </div>
        ) : focused ? (
          <p className="mt-1.5 px-2 text-2xs text-muted-foreground">
            Try “fix login @shanika friday high -- 2FA users see a blank screen”
          </p>
        ) : null}
      </div>

      {/* The bulk-paste review panel: every row is editable and untickable,
          nothing is created until Add is pressed, and the whole thing is
          dismissible (button or Escape) — the labeled/editable/dismissible
          contract every AI assist on this surface follows. */}
      {paste ? (
        <div
          role="group"
          aria-label="Review pasted tasks"
          onKeyDown={(event) => {
            if (event.key !== 'Escape' || isPending) return
            event.stopPropagation()
            setPaste(null)
          }}
          className={cn(
            'mt-1.5 flex flex-col gap-2 rounded-md border border-input bg-card p-2',
            'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1',
            'motion-safe:duration-150 motion-safe:ease-out',
          )}
        >
          <p className="text-xs font-medium" role="status">
            {paste.source === 'ai' ? (
              <span className="inline-flex items-center gap-1">
                <Sparkles className="size-3 shrink-0 text-primary" aria-hidden />
                AI draft — check names and dates before adding
              </span>
            ) : (
              `Pasted ${paste.rows.length} ${paste.rows.length === 1 ? 'line' : 'lines'} — review before adding`
            )}
            {paste.truncated ? (
              <span className="text-muted-foreground"> · first {MAX_PASTE_TASKS} lines only</span>
            ) : null}
          </p>

          <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
            {paste.rows.map((row) => {
              const resolvedName = row.assigneeId ? (nameById.get(row.assigneeId) ?? row.assigneeName) : null
              const offApp = row.assigneeId !== null && !teamIds.has(row.assigneeId)
              return (
                <li key={row.key} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={row.include}
                    onChange={() => setRow(row.key, { include: !row.include })}
                    aria-label={`Include “${row.title || 'untitled task'}”`}
                    disabled={isPending}
                    className="mt-1.5 size-4 shrink-0 cursor-pointer accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <Input
                      value={row.title}
                      onChange={(event) => setRow(row.key, { title: event.target.value })}
                      aria-label="Task title"
                      maxLength={140}
                      disabled={isPending}
                      className="h-7 text-xs"
                    />
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1 text-2xs text-muted-foreground">
                      {resolvedName ? (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1',
                            offApp ? 'text-warning' : 'text-foreground',
                          )}
                        >
                          <UserRound className="size-3 shrink-0" aria-hidden />
                          {resolvedName}
                          {offApp ? ' (not on this app)' : null}
                        </span>
                      ) : row.assigneeName ? (
                        <span className="inline-flex items-center gap-1 text-warning">
                          <UserRound className="size-3 shrink-0" aria-hidden />
                          “{row.assigneeName}” — no match, adding unassigned
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <UserRound className="size-3 shrink-0" aria-hidden />
                          Unassigned
                        </span>
                      )}
                      {row.dueDate ? (
                        <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                          <CalendarDays className="size-3 shrink-0" aria-hidden />
                          {shortDue(row.dueDate)}
                        </span>
                      ) : null}
                      {row.priority > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <Flag className="size-3 shrink-0" aria-hidden />
                          {PRIORITY_LABEL[row.priority]}
                        </span>
                      ) : null}
                      {row.description ? (
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <TextIcon className="size-3 shrink-0" aria-hidden />
                          <span className="truncate">{row.description}</span>
                        </span>
                      ) : null}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>

          {aiError ? (
            <p role="alert" className="text-2xs text-destructive">
              {aiError}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={createFromPaste}
              disabled={isPending || includedCount === 0}
            >
              {isPending ? (
                <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
              ) : null}
              Add {includedCount} {includedCount === 1 ? 'task' : 'tasks'}
            </Button>
            {/* Costs one Gemini call on the caller's own keys, so it is a
                button the person presses — never automatic on paste. */}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={refineWithAi}
              disabled={aiPending || isPending}
            >
              {aiPending ? (
                <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
              ) : (
                <Sparkles aria-hidden />
              )}
              {aiPending ? 'Drafting…' : 'Draft tasks with AI'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={() => setPaste(null)}
              disabled={isPending}
            >
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
