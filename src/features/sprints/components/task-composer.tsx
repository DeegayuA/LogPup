'use client'

import { useId, useMemo, useState, useTransition, type KeyboardEvent } from 'react'
import {
  CalendarDays,
  CornerDownLeft,
  Flag,
  Loader2,
  Text as TextIcon,
  UserRound,
  UserRoundPlus,
} from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { createTask } from '@/features/sprints/task-actions'
import { planFor } from '@/features/sprints/composer-plan'
import type { IntentPerson } from '@/lib/task-intent'
import type { GroupPatch } from '@/features/sprints/board-view'

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
  const previewId = useId()

  const intentPeople = useMemo<IntentPerson[]>(
    () => people.map(({ id, name }) => ({ id, name })),
    [people],
  )
  // Parsed on every keystroke — parseTaskIntent is pure and local, so there is
  // no round trip between typing and seeing what will happen.
  const plan = useMemo(() => planFor(draft, intentPeople, new Date()), [draft, intentPeople])

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
    if (event.key !== 'Enter') return
    event.preventDefault()
    submit()
  }

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
    </div>
  )
}
