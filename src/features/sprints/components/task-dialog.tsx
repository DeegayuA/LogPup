'use client'

import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MentionTextarea } from '@/components/mention-textarea'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useRouter } from 'next/navigation'
import { createTask, updateTask, deleteTask } from '@/features/sprints/task-actions'
import { can, type UserRole } from '@/features/auth/capabilities'
import { STATUS_LABEL, TASK_STATUSES, type TaskStatus } from '@/features/sprints/board-view'
import { listParentOptions, type ParentOption, type SprintOption } from '@/features/sprints/actions'
import type { TaskWithAssignee } from '@/features/sprints/queries'
import {
  ALLOWED_PARENT, CHILD_TYPE, TASK_TYPES, TASK_TYPE_LABEL, TASK_TYPE_PLURAL, type TaskType,
} from '@/features/sprints/hierarchy'
import type { BoardChild } from '@/features/sprints/queries'
import { TaskTypeIcon } from '@/features/sprints/components/task-type-icon'
import { ChildDoneToggle } from '@/features/sprints/components/child-done-toggle'
import { withStatusOverrides, type StatusOverrides } from '@/features/sprints/child-toggle'
import { AcceptanceCriteria } from '@/features/sprints/components/acceptance-criteria'
import { TaskTagsField } from '@/features/sprints/components/task-tags-field'
import { TaskLinks } from '@/features/sprints/components/task-links'
import { TaskAttachments } from '@/features/sprints/components/task-attachments'
import { TaskComments } from '@/features/sprints/components/task-comments'

/** Sentinel for "no parent" — same reason as BACKLOG below. */
const NO_PARENT = '__no_parent__'
/** Sentinel for "nobody recorded" on the reporter select. */
const NO_REPORTER = '__no_reporter__'

const UNASSIGNED = '__unassigned__'

// Same empty-scope trick as `canMoveTask`: no client-safe way to know which
// apps a manager/editor reaches, so a scoped grant reduces to owns-only here.
const EMPTY_SCOPE: ReadonlySet<string> = new Set()
/** Sentinel for "no sprint" — a Select value must be a non-empty string, and
 *  the backlog is a real choice, not the absence of one. */
const BACKLOG = '__backlog__'

const PRIORITY_OPTIONS = [
  { value: '0', label: 'None' },
  { value: '1', label: 'Low' },
  { value: '2', label: 'Medium' },
  { value: '3', label: 'High' },
]

type FormState = {
  title: string
  description: string
  assigneeId: string
  priority: string
  status: TaskStatus
  /** yyyy-mm-dd or '' — the native date input's own empty value. */
  dueDate: string
  sprintId: string
  type: TaskType
  parentId: string
  /** The raw input text: '' = not estimated (null), never 0. */
  storyPoints: string
  startDate: string
  reporterId: string
  environment: string
}

function toFormState(task: TaskWithAssignee): FormState {
  return {
    title: task.title,
    description: task.description ?? '',
    assigneeId: task.assignee?.id ?? UNASSIGNED,
    priority: String(task.priority),
    status: task.status,
    dueDate: task.dueDate ?? '',
    sprintId: task.sprintId ?? BACKLOG,
    type: task.type,
    parentId: task.parentId ?? NO_PARENT,
    storyPoints: task.storyPoints === null ? '' : String(task.storyPoints),
    startDate: task.startDate ?? '',
    reporterId: task.reporterId ?? NO_REPORTER,
    environment: task.environment ?? '',
  }
}

function emptyForm(): FormState {
  return {
    title: '',
    description: '',
    assigneeId: UNASSIGNED,
    priority: '0',
    status: 'todo',
    dueDate: '',
    sprintId: BACKLOG,
    type: 'task',
    parentId: NO_PARENT,
    storyPoints: '',
    startDate: '',
    reporterId: NO_REPORTER,
    environment: '',
  }
}

const NO_PEOPLE: { userId: string; name: string }[] = []

export function TaskDialog({
  task,
  appId,
  appSlug,
  boardSprintId = null,
  team,
  otherPeople = NO_PEOPLE,
  role,
  canManageTasks = false,
  canDeleteTasks = false,
  currentUserId,
  onOpenChange,
  mentionUsers,
  sprintOptions,
  sprintOptionsFailed = false,
  onNeedSprintOptions,
}: {
  task: TaskWithAssignee | null
  /** For the Parent picker's options. Optional so a caller outside the board
   *  still renders; without it the picker shows only the current parent. */
  appId?: string
  /** For the Links section's hrefs; without it that section is not shown. */
  appSlug?: string
  /** The sprint the board is showing (null = backlog). New children land
   *  here, not on the parent's own sprintId: a task whose sprint was trashed
   *  sits in the backlog but still points at the dead sprint, which
   *  createTask would refuse. */
  boardSprintId?: string | null
  team: { userId: string; name: string }[]
  /** Everyone else in the workspace, offered under the team in the Assignee
   *  select. A bug or sub-task often lands on someone who was never added to
   *  the project's Team, and createTask/updateTask only require a real user. */
  otherPeople?: { userId: string; name: string }[]
  /** The viewer's REAL role (board.tsx's `currentUser.role`), not a fabricated
   *  admin/member pair. The old `isAdmin ? 'admin' : 'member'` forgery
   *  over-showed for a stakeholder (task.edit: none, forged as member's
   *  own-arm) and under-granted an editor (task.edit: scoped, forged down to
   *  member's own-arm) — the local `can()` call below needs the real seat to
   *  answer either question correctly. */
  role: UserRole
  /** `task.edit` resolved server-side with the real app scope
   *  (page.tsx → Board → here). Manager and editor are 'scoped' for
   *  task.edit, which this dialog's client-only `can()` call below cannot
   *  answer for — it has no way to know which apps this actor reaches — so
   *  without this a PM/lead saw every field on a teammate's card disabled
   *  even though `updateTask` would accept the save. */
  canManageTasks?: boolean
  /** `task.delete` resolved server-side with the real app scope, same shape
   *  as `canManageTasks`. task.delete is its OWN row — manager: scoped,
   *  editor: NONE — so `canManageTasks` (task.edit) is the wrong proxy for
   *  the Delete control: task.delete has no 'own' arm at any seat, so unlike
   *  `canEdit` below there is no client-side owner fallback to add. */
  canDeleteTasks?: boolean
  /** Who is looking. `updateTask` allows an admin, this project's PM/lead or
   *  editor, or the task's own assignee, and refuses everyone else — without
   *  this the dialog cannot tell which one you are, so it offers a form that
   *  only fails on Save. */
  currentUserId?: string
  onOpenChange: (open: boolean) => void
  /** Wider mention pool (e.g. all active users) — falls back to the app team. */
  mentionUsers?: { id: string; name: string }[]
  /** Null until the app's sprints have been fetched; the control says so
   *  rather than silently offering only the backlog. */
  sprintOptions?: SprintOption[] | null
  /** True once that fetch has failed — so the control can say so instead of
   *  claiming to still be loading. */
  sprintOptionsFailed?: boolean
  onNeedSprintOptions?: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState<FormState>(() => (task ? toFormState(task) : emptyForm()))
  // Tracks the task object we last synced `form` from, so we can re-seed the
  // form whenever a (possibly different, or freshly-refetched) task is
  // opened. Adjusting state during render — rather than in a useEffect — is
  // the React-recommended way to reset state in response to a prop change:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [syncedTask, setSyncedTask] = useState(task)
  // Children this dialog added since it opened. The board refreshes behind
  // the dialog, but `task` here is the snapshot it was opened with, so the
  // list would otherwise not show what you just typed until a reopen.
  const [addedChildren, setAddedChildren] = useState<BoardChild[]>([])
  // Ticks made here, for the same snapshot reason as addedChildren.
  const [childStatus, setChildStatus] = useState<StatusOverrides>({})
  const [newChildTitle, setNewChildTitle] = useState('')
  const [addingChild, startAddChild] = useTransition()
  // A real guard, not the transition flag: Enter followed by a click on Add
  // can both run before React has re-rendered with `addingChild` true.
  const addBusy = useRef(false)
  if (task !== syncedTask) {
    setSyncedTask(task)
    if (task) setForm(toFormState(task))
    setAddedChildren([])
    setChildStatus({})
    setNewChildTitle('')
  }
  const router = useRouter()
  const assignable = [...team, ...otherPeople]
  // The footer's Save sits OUTSIDE the <form> (the self-saving sections live
  // between them), so it names the form it submits.
  const formId = useId()

  /*
   * The same matrix `updateTask` asks server-side, via `can()` rather than a
   * hand-rolled admin-or-assignee pair — the earlier version under-granted
   * every scoped seat (a PM/lead could not edit a task they had not assigned
   * to themselves). This is presentation only (the action re-checks with the
   * real scope), but the client-only `can()` call below still cannot tell a
   * scoped manager/editor from an unscoped one — it has no way to know which
   * apps this actor reaches — so `canManageTasks` (task.edit, resolved with
   * the real appId in page.tsx) is checked FIRST, and the local `can()` call
   * only has to cover the true owns-only case (a member on their own card).
   * Mirroring the server's answer stops the dialog from being a dead end: a
   * member opening a teammate's card previously got every field enabled,
   * typed a change, pressed Save and was told "Not allowed" with their edit
   * still on screen and nowhere to go.
   * `currentUserId` is optional for callers outside the board, which get the
   * previous always-editable behaviour rather than a silently read-only
   * dialog.
   */
  const canEdit =
    currentUserId === undefined ||
    canManageTasks ||
    can(
      { id: currentUserId, role, scopeAppIds: EMPTY_SCOPE },
      'task.edit',
      { ownerId: task?.assignee?.id ?? null },
    )

  // Fetching the app's other sprints is a real request, so it waits until a
  // dialog is actually opened — a board nobody edits never pays for it.
  const isOpen = task !== null
  useEffect(() => {
    if (isOpen) onNeedSprintOptions?.()
  }, [isOpen, onNeedSprintOptions])

  // Parent candidates, fetched fresh on every open rather than latched like
  // the sprints: items are created far more often than sprints, and a stale
  // list would hide the epic somebody made a minute ago. Null = loading.
  const [parentOptions, setParentOptions] = useState<ParentOption[] | null>(null)
  const [parentOptionsFailed, setParentOptionsFailed] = useState(false)
  useEffect(() => {
    if (!isOpen || !appId) return
    let cancelled = false
    listParentOptions(appId)
      .then((res) => {
        if (cancelled) return
        if (res.ok) setParentOptions(res.data)
        else setParentOptionsFailed(true)
      })
      .catch(() => {
        if (!cancelled) setParentOptionsFailed(true)
      })
    return () => {
      cancelled = true
      setParentOptions(null)
      setParentOptionsFailed(false)
    }
  }, [isOpen, appId])

  // Only parents this type may sit under, never the task itself. The server
  // re-checks with the real tree (cycles, depth), so this is guidance.
  const allowedParents = (parentOptions ?? []).filter(
    (p) => p.id !== task?.id && ALLOWED_PARENT[form.type].includes(p.type),
  )
  const currentParent = (parentOptions ?? []).find((p) => p.id === form.parentId)

  function parentLabel(p: ParentOption): string {
    return `${p.taskKey ? `${p.taskKey} · ` : ''}${p.title}`
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!task || !canEdit) return
    // A name still sitting in the "+ Add" box would otherwise be thrown away
    // by Save without a word.
    if (newChildTitle.trim() !== '') {
      toast.warning(`Press Add to add “${newChildTitle.trim()}” first, or clear that box`)
      return
    }
    startTransition(async () => {
      try {
        const res = await updateTask(task.id, {
          title: form.title,
          description: form.description,
          assigneeId: form.assigneeId === UNASSIGNED ? null : form.assigneeId,
          priority: Number(form.priority),
          status: form.status,
          // '' from a cleared native date input means "no due date". Sending
          // '' would fail the ISO-date check and reject the whole save.
          dueDate: form.dueDate === '' ? null : form.dueDate,
          sprintId: form.sprintId === BACKLOG ? null : form.sprintId,
          type: form.type,
          parentId: form.parentId === NO_PARENT ? null : form.parentId,
          // '' is "not estimated" — null, never 0.
          storyPoints: form.storyPoints.trim() === '' ? null : Number(form.storyPoints),
          startDate: form.startDate === '' ? null : form.startDate,
          reporterId: form.reporterId === NO_REPORTER ? null : form.reporterId,
          environment: form.environment.trim() === '' ? null : form.environment.trim(),
        })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Task updated')
        onOpenChange(false)
      } catch {
        // A thrown error (e.g. DB outage) is not `{ ok: false }` — without
        // this catch it's an unhandled rejection and Save silently does
        // nothing.
        toast.error('Something went wrong — try again')
      }
    })
  }

  // "+ Add" under this item: the child's type and parent are decided here
  // (CHILD_TYPE), never asked — the whole point is that nobody has to know
  // what a parent or a sub-task is to break work down. From the SAVED type,
  // not the form's: an unsaved type change has not happened yet.
  const childType = task ? CHILD_TYPE[task.type] : null
  const allChildren = withStatusOverrides([...(task?.children ?? []), ...addedChildren], childStatus)

  function addChild() {
    const title = newChildTitle.trim()
    if (!task || !appId || !childType || title === '' || addBusy.current) return
    addBusy.current = true
    startAddChild(async () => {
      try {
        const res = await createTask({
          appId,
          // The board being looked at, so the new item appears right there.
          sprintId: boardSprintId,
          title,
          assigneeId: null,
          type: childType,
          parentId: task.id,
        })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        setAddedChildren((list) => [
          ...list,
          { id: res.data.taskId, taskKey: null, title, status: 'todo', type: childType },
        ])
        setNewChildTitle('')
        toast.success(`${TASK_TYPE_LABEL[childType]} added`)
        router.refresh()
      } catch {
        toast.error('Something went wrong — try again')
      } finally {
        addBusy.current = false
      }
    })
  }

  function handleDelete() {
    if (!task) return
    startTransition(async () => {
      try {
        const res = await deleteTask(task.id)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Task deleted')
        onOpenChange(false)
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  return (
    <Dialog open={task !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {task?.taskKey ? (
              <span className="font-mono text-sm font-normal text-muted-foreground tabular-nums">
                {task.taskKey}
              </span>
            ) : null}
            {canEdit ? `Edit ${TASK_TYPE_LABEL[form.type].toLowerCase()}` : TASK_TYPE_LABEL[form.type]}
          </DialogTitle>
          <DialogDescription>
            {canEdit
              ? 'Update the task’s details.'
              : task?.assignee
                ? `Only an admin, this project's PM/lead or editor, or ${task.assignee.name} can change this task.`
                : 'Only an admin, or this project’s PM/lead or editor, can change an unassigned task.'}
          </DialogDescription>
        </DialogHeader>
        <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              minLength={1}
              maxLength={140}
              required
              disabled={!canEdit}
              className="h-9 font-medium md:text-base"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-description">Description</Label>
            <MentionTextarea
              id="task-description"
              disabled={!canEdit}
              users={mentionUsers ?? team.map((m) => ({ id: m.userId, name: m.name }))}
              value={form.description}
              onValueChange={(description) => setForm((f) => ({ ...f, description }))}
              onMention={(user) => {
                /* A mention doubles as an assignment hint — but only when the
                   assignee is still unset and the mentioned user is actually
                   a valid assignee option. */
                if (form.assigneeId !== UNASSIGNED) return
                if (!assignable.some((m) => m.userId === user.id)) return
                setForm((f) => ({ ...f, assigneeId: user.id }))
                toast.info(`Assigned to ${user.name} from mention`)
              }}
              maxLength={2000}
              className="min-h-24"
            />
          </div>
          {/* What it is and where it sits — PRD Module A's hierarchy. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-type">Type</Label>
              <Select
                value={form.type}
                disabled={!canEdit}
                onValueChange={(value) => setForm((f) => ({ ...f, type: (value ?? 'task') as TaskType }))}
              >
                <SelectTrigger id="task-type" className="w-full">
                  <SelectValue>
                    {(value: string) => (
                      <span className="flex items-center gap-2">
                        <TaskTypeIcon type={value as TaskType} />
                        {TASK_TYPE_LABEL[value as TaskType] ?? 'Task'}
                      </span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      <span className="flex items-center gap-2">
                        <TaskTypeIcon type={type} />
                        {TASK_TYPE_LABEL[type]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-parent">Parent</Label>
              <Select
                value={form.parentId}
                disabled={!canEdit || ALLOWED_PARENT[form.type].length === 0}
                onValueChange={(value) => setForm((f) => ({ ...f, parentId: value ?? NO_PARENT }))}
              >
                <SelectTrigger id="task-parent" className="w-full">
                  <SelectValue>
                    {(value: string) =>
                      value === NO_PARENT
                        ? ALLOWED_PARENT[form.type].length === 0
                          ? `${TASK_TYPE_LABEL[form.type]}s sit at the top`
                          : 'No parent'
                        : currentParent
                          ? parentLabel(currentParent)
                          : 'Current parent'
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PARENT}>No parent</SelectItem>
                  {/* The saved parent stays selectable while loading, or when
                      it no longer fits the chosen type — the server then says
                      why on Save instead of the choice silently vanishing. */}
                  {form.parentId !== NO_PARENT && !allowedParents.some((p) => p.id === form.parentId) ? (
                    <SelectItem value={form.parentId}>
                      {currentParent ? parentLabel(currentParent) : 'Current parent'}
                    </SelectItem>
                  ) : null}
                  {allowedParents.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        <TaskTypeIcon type={p.type} />
                        <span className="truncate">{parentLabel(p)}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {appId && parentOptions === null ? (
                <p className="text-2xs text-muted-foreground" role="status">
                  {parentOptionsFailed
                    ? 'Couldn’t load possible parents — reopen this task to try again.'
                    : 'Loading possible parents…'}
                </p>
              ) : null}
            </div>
          </div>
          {/* key: switching tasks must remount it, or the previous task's
              tags would be saved onto this one. */}
          {task ? <TaskTagsField key={task.id} taskId={task.id} canEdit={canEdit} /> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-assignee">Assignee</Label>
              <Select
                value={form.assigneeId}
                disabled={!canEdit}
                onValueChange={(value) => setForm((f) => ({ ...f, assigneeId: value ?? UNASSIGNED }))}
              >
                <SelectTrigger id="task-assignee" className="w-full">
                  {/* Explicit label mapping — the raw id is the Select's `value`,
                      so without this the trigger falls back to rendering that id
                      (a UUID) instead of the assignee's name. An id that isn't in
                      `team` (assignee since removed from the app) is labelled
                      honestly rather than as "Unassigned", which would tell the
                      editor the task is free while still saving the hidden id. */}
                  <SelectValue>
                    {(value: string) =>
                      value === UNASSIGNED
                        ? 'Unassigned'
                        : (assignable.find((member) => member.userId === value)?.name ??
                          'Assigned — no longer active')
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {form.assigneeId !== UNASSIGNED &&
                  !assignable.some((member) => member.userId === form.assigneeId) ? (
                    <SelectItem value={form.assigneeId}>
                      Current assignee — no longer active
                    </SelectItem>
                  ) : null}
                  <SelectGroup>
                    {otherPeople.length > 0 ? <SelectLabel>This project&apos;s team</SelectLabel> : null}
                    {team.map((member) => (
                      <SelectItem key={member.userId} value={member.userId}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  {otherPeople.length > 0 ? (
                    <SelectGroup>
                      <SelectLabel>Everyone else</SelectLabel>
                      {otherPeople.map((person) => (
                        <SelectItem key={person.userId} value={person.userId}>
                          {person.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-priority">Priority</Label>
              <Select
                value={form.priority}
                disabled={!canEdit}
                onValueChange={(value) => setForm((f) => ({ ...f, priority: value ?? '0' }))}
              >
                <SelectTrigger id="task-priority" className="w-full">
                  {/* Same explicit mapping as the assignee select above — the
                      value is a numeric code ('0'-'3'), not the label. */}
                  <SelectValue>
                    {(value: string) =>
                      PRIORITY_OPTIONS.find((opt) => opt.value === value)?.label ?? 'None'
                    }
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
          {/*
            Status, due date and sprint were previously unreachable: status
            could ONLY be changed by a pointer drag (so keyboard-only users
            could never move a task at all), a due date could be set by the
            quick-add and then never seen or edited again, and there was no
            way anywhere in the product to move a task between sprints even
            though the action already accepted it.
          */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-status">Status</Label>
              <Select
                value={form.status}
                disabled={!canEdit}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, status: (value ?? 'todo') as TaskStatus }))
                }
              >
                <SelectTrigger id="task-status" className="w-full">
                  <SelectValue>
                    {(value: string) => STATUS_LABEL[value as TaskStatus] ?? 'To do'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_LABEL[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-due">Due date</Label>
              <Input
                id="task-due"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                disabled={!canEdit}
                className="h-9 font-mono hover:border-ring/40"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-sprint">Sprint</Label>
              <Select
                value={form.sprintId}
                disabled={!canEdit}
                onValueChange={(value) => setForm((f) => ({ ...f, sprintId: value ?? BACKLOG }))}
              >
                <SelectTrigger id="task-sprint" className="w-full">
                  <SelectValue>
                    {(value: string) =>
                      value === BACKLOG
                        ? 'Backlog'
                        : (sprintOptions?.find((sprint) => sprint.id === value)?.name ??
                          'Current sprint')
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BACKLOG}>Backlog (no sprint)</SelectItem>
                  {/* The task's own sprint must remain selectable while the
                      list is still loading, or reopening the dialog would
                      offer no way back to where the task already is. */}
                  {form.sprintId !== BACKLOG &&
                  !(sprintOptions ?? []).some((sprint) => sprint.id === form.sprintId) ? (
                    <SelectItem value={form.sprintId}>Current sprint</SelectItem>
                  ) : null}
                  {(sprintOptions ?? []).map((sprint) => (
                    <SelectItem key={sprint.id} value={sprint.id}>
                      {sprint.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Three states, all said out loud: loading, failed, and the
                  ordinary list. Silence on failure would leave a control
                  offering only "Backlog" and looking like the truth. */}
              {sprintOptions === null ? (
                <p className="text-2xs text-muted-foreground" role="status">
                  {sprintOptionsFailed
                    ? 'Couldn’t load this app’s sprints — reopen this task to try again.'
                    : 'Loading sprints…'}
                </p>
              ) : null}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-points">Story points</Label>
              <Input
                id="task-points"
                type="number"
                inputMode="decimal"
                min={0}
                max={9999.9}
                step={0.5}
                placeholder="Not estimated"
                value={form.storyPoints}
                onChange={(e) => setForm((f) => ({ ...f, storyPoints: e.target.value }))}
                disabled={!canEdit}
                className="h-9 font-mono"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-start">Start date</Label>
              <Input
                id="task-start"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                disabled={!canEdit}
                className="h-9 font-mono hover:border-ring/40"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-reporter">Reporter</Label>
              <Select
                value={form.reporterId}
                disabled={!canEdit}
                onValueChange={(value) => setForm((f) => ({ ...f, reporterId: value ?? NO_REPORTER }))}
              >
                <SelectTrigger id="task-reporter" className="w-full">
                  <SelectValue>
                    {(value: string) =>
                      value === NO_REPORTER
                        ? 'Not recorded'
                        : (team.find((m) => m.userId === value)?.name ?? 'Not on this app team')
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_REPORTER}>Not recorded</SelectItem>
                  {form.reporterId !== NO_REPORTER && !team.some((m) => m.userId === form.reporterId) ? (
                    <SelectItem value={form.reporterId}>Current reporter — not on this app team</SelectItem>
                  ) : null}
                  {team.map((member) => (
                    <SelectItem key={member.userId} value={member.userId}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-environment">Environment</Label>
              <Input
                id="task-environment"
                value={form.environment}
                placeholder="e.g. staging"
                maxLength={60}
                onChange={(e) => setForm((f) => ({ ...f, environment: e.target.value }))}
                disabled={!canEdit}
                className="h-9"
              />
            </div>
          </div>
        </form>
        <DialogFooter className="justify-between sm:justify-between">
          {canDeleteTasks ? (
            <AlertDialog>
              <AlertDialogTrigger render={<Button type="button" variant="destructive" />}>
                Delete
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this task?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Moves &ldquo;{task?.title}&rdquo; to Trash — admins can view and restore it.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/80"
                    onClick={handleDelete}
                    disabled={isPending}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <span />
          )}
          {canEdit ? (
            <Button type="submit" form={formId} disabled={isPending}>
              {isPending ? 'Saving…' : 'Save changes'}
            </Button>
          ) : (
            // No Save at all rather than a disabled one: there is nothing
            // this person can do to enable it, and a permanently greyed
            // button reads as a bug to be poked at.
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
        {/* Below the form on purpose: everything from here saves on its own,
            the moment you act — "Save changes" above covers only the fields.
            Keyed by task id so switching tasks remounts each section instead of
            showing (and saving) the previous task's data. */}
        {task ? (
          <div key={task.id} className="flex flex-col gap-6 border-t pt-4">
            <section className="flex flex-col gap-4" aria-labelledby="task-sec-breakdown">
              <h3 id="task-sec-breakdown" className="text-sm font-semibold">Breakdown</h3>
          {/* Break it down, right here: what is under this item, and a box to
              add the next one. Placed above the advanced Type/Parent fields
              on purpose — this is the way people are expected to build the
              tree; those fields are for fixing it. */}
          {/* Only for someone who may edit this item: an add box beside a
              read-only form would be the one live control in a dialog that
              otherwise says "you can't change this". */}
          {childType && appId && canEdit ? (
            <div className="flex flex-col gap-1.5 rounded-lg border bg-muted/30 p-3">
              <Label htmlFor="task-add-child">
                {TASK_TYPE_PLURAL[childType]} in this {TASK_TYPE_LABEL[task?.type ?? 'task'].toLowerCase()}
                {allChildren.length > 0
                  ? ` (${allChildren.filter((c) => c.status === 'done').length} of ${allChildren.length} done)`
                  : ''}
              </Label>
              {allChildren.length > 0 ? (
                <ul className="flex flex-col gap-1" aria-label={`Items in this ${TASK_TYPE_LABEL[task?.type ?? 'task'].toLowerCase()}`}>
                  {allChildren.map((c) => (
                    <li key={c.id} className="flex items-center gap-2 text-sm">
                      <ChildDoneToggle
                        id={c.id}
                        title={c.title}
                        status={c.status}
                        canEdit={canEdit}
                        onChange={(next) => setChildStatus((s) => ({ ...s, [c.id]: next }))}
                      />
                      <TaskTypeIcon type={c.type} />
                      {c.taskKey ? (
                        <span className="font-mono text-2xs text-muted-foreground tabular-nums">{c.taskKey}</span>
                      ) : null}
                      <span className={c.status === 'done' ? 'text-muted-foreground line-through' : undefined}>
                        {c.title}
                      </span>
                      <span className="sr-only">, {STATUS_LABEL[c.status]}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-2xs text-muted-foreground">
                  Nothing under this yet. Break it into smaller pieces below.
                </p>
              )}
              <div className="flex gap-2">
                <Input
                  id="task-add-child"
                  value={newChildTitle}
                  placeholder={`+ Add a ${TASK_TYPE_LABEL[childType].toLowerCase()} — type a name, press Enter`}
                  maxLength={140}
                  // readOnly, not disabled: disabling the focused box throws
                  // focus to <body> and breaks "type, Enter, type, Enter".
                  readOnly={addingChild}
                  aria-busy={addingChild || undefined}
                  onChange={(e) => setNewChildTitle(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter adds a child (and must never reach a form). Escape
                    // with text typed clears the box instead of closing the
                    // whole dialog and losing it.
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addChild()
                    } else if (e.key === 'Escape' && newChildTitle !== '') {
                      e.preventDefault()
                      e.stopPropagation()
                      setNewChildTitle('')
                    }
                  }}
                  className="h-9"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={addingChild || newChildTitle.trim() === ''}
                  onClick={addChild}
                >
                  {addingChild ? 'Adding…' : 'Add'}
                </Button>
              </div>
            </div>
          ) : null}
              {/* "Done means…" — the checklist QA tests against (PRD Module A). */}
              <AcceptanceCriteria taskId={task.id} canEdit={canEdit} />
            </section>
            <section className="flex flex-col gap-4" aria-labelledby="task-sec-related">
              <h3 id="task-sec-related" className="text-sm font-semibold">Related</h3>
              {appSlug ? <TaskLinks taskId={task.id} appSlug={appSlug} canEdit={canEdit} /> : null}
              <TaskAttachments taskId={task.id} canEdit={canEdit} />
            </section>
            <section className="flex flex-col gap-4" aria-labelledby="task-sec-discussion">
              <h3 id="task-sec-discussion" className="text-sm font-semibold">Discussion</h3>
              {/* The comment action decides who may post (task.comment); the
                  section hides its composer from anyone it would refuse. */}
              <TaskComments taskId={task.id} canComment />
            </section>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
