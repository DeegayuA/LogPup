'use client'

import { useId, useMemo, useState, useTransition, type KeyboardEvent } from 'react'
import { CalendarDays, CornerDownLeft, Loader2, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { createTask } from '@/features/sprints/task-actions'
import { parseTaskIntent, type IntentPerson } from '@/lib/task-intent'
import type { GroupPatch } from '@/features/sprints/board-view'

/** What Enter will actually do — shown to the user before it does it. */
type ComposerPlan = {
  title: string
  assignee: IntentPerson | null
  /** A name that matched several teammates. Blocks Enter until it's narrowed. */
  ambiguousQuery: string | null
  ambiguousNames: string[]
  /** A name that matched nobody on this app's team. Still creates, unassigned. */
  unresolvedQuery: string | null
  due: string | null
  dueLabel: string | null
}

/**
 * Reads the draft the same way the ⌘K palette does, then adapts the result to
 * a board column, where two things differ:
 *
 * - an "on <app>" hint is meaningless (this board IS the app), so those words
 *   go back into the title instead of disappearing;
 * - a name that resolves to nobody falls back to the text exactly as typed, so
 *   an unknown "@bob" is never silently deleted from the task.
 */
function planFor(raw: string, people: IntentPerson[], today: Date): ComposerPlan | null {
  const text = raw.trim().replace(/\s+/g, ' ')
  if (!text) return null

  // The floor the parser refuses to read (too short, or nothing but a date):
  // capture it verbatim rather than refusing the task.
  const verbatim: ComposerPlan = {
    title: text,
    assignee: null,
    ambiguousQuery: null,
    ambiguousNames: [],
    unresolvedQuery: null,
    due: null,
    dueLabel: null,
  }

  const intent = parseTaskIntent(text, people, today)
  if (!intent) return verbatim

  const title = intent.appQuery ? `${intent.title} on ${intent.appQuery}` : intent.title

  if (intent.ambiguous.length > 1) {
    return {
      ...verbatim,
      title,
      ambiguousQuery: intent.assigneeQuery,
      ambiguousNames: intent.ambiguous.map((p) => p.name),
      due: intent.due,
      dueLabel: intent.dueLabel,
    }
  }
  if (intent.assigneeQuery) return { ...verbatim, unresolvedQuery: intent.assigneeQuery }

  return {
    ...verbatim,
    title,
    assignee: intent.assignee,
    due: intent.due,
    dueLabel: intent.dueLabel,
  }
}

/**
 * The inline "Add a task…" field at the foot of every board column.
 *
 * Enter creates the task; everything above the field is a live, read-only
 * account of how the phrase was understood. The preview is the point: a parser
 * that quietly rewrites what you typed is worse than no parser at all, because
 * you can't tell it happened.
 */
export function TaskComposer({
  patch,
  columnTitle,
  team,
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
  team: { userId: string; name: string }[]
  appId: string
  sprintId: string | null
}) {
  const [draft, setDraft] = useState('')
  const [focused, setFocused] = useState(false)
  const [isPending, startTransition] = useTransition()
  const previewId = useId()

  const people = useMemo<IntentPerson[]>(
    () => team.map((member) => ({ id: member.userId, name: member.name })),
    [team],
  )
  // Parsed on every keystroke — parseTaskIntent is pure and local, so there is
  // no round trip between typing and seeing what will happen.
  const plan = useMemo(() => planFor(draft, people, new Date()), [draft, people])

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
        const res = await createTask({
          appId,
          sprintId,
          title: plan.title,
          // A name typed into the field beats the column's implied assignee:
          // the preview above the input has already said out loud who it
          // resolved to, so honouring the column instead would contradict
          // what the user was just shown.
          assigneeId: plan.assignee?.id ?? patch.assigneeId ?? null,
          priority: patch.priority ?? 0,
          status: patch.status ?? 'todo',
          dueDate: plan.due,
        })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        setDraft('')
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    submit()
  }

  return (
    <div className="mt-2 flex flex-col">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Add a task…"
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
              {plan.assignee ? (
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
                  No one here called “{plan.unresolvedQuery}” — adding unassigned
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <UserRound className="size-3 shrink-0" aria-hidden />
                  Unassigned
                </span>
              )}
              {plan.dueLabel ? (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3 shrink-0" aria-hidden />
                  {plan.dueLabel}
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
            Try “fix login to shanika friday”
          </p>
        ) : null}
      </div>
    </div>
  )
}
