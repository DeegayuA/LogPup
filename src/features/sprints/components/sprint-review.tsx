'use client'

import { useState, useTransition } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { selectTriggerClassName } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { STATUS_LABEL, type TaskStatus } from '@/features/sprints/board-view'
import { addFeedback, deleteFeedback } from '@/features/sprints/scrum-actions'
import type { ReviewTask, SprintFeedbackItem, SprintReview as SprintReviewData } from '@/features/sprints/scrum-queries'

/**
 * The sprint review: what was promised (the goal), what got done, what did
 * not, what shipped, where QA stands, the bugs, and what stakeholders said.
 *
 * Feedback is the only interactive part. It relies on the action's
 * revalidatePath to show the new row rather than an optimistic copy: a review
 * is a meeting-paced surface, and a stale-looking second is cheaper than a
 * rollback path.
 */

function statusLabel(status: string): string {
  return STATUS_LABEL[status as TaskStatus] ?? status
}

function TaskList({ title, tasks, empty }: { title: string; tasks: ReviewTask[]; empty: string }) {
  const id = `review-${title.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      <h3 id={id} className="flex items-baseline justify-between font-heading text-sm font-semibold">
        {title}
        <span className="font-mono text-2xs font-normal text-muted-foreground tabular-nums">{tasks.length}</span>
      </h3>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {tasks.map((t) => (
            <li key={t.id} className="flex flex-col">
              <span>
                {t.taskKey ? <span className="mr-1.5 font-mono text-2xs text-muted-foreground">{t.taskKey}</span> : null}
                {t.title}
              </span>
              <span className="text-2xs text-muted-foreground">
                {statusLabel(t.status)} · {t.assigneeName ?? 'Nobody assigned'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function SprintReview({
  sprintId,
  review,
  feedback,
  currentUserId,
  canManage,
}: {
  sprintId: string
  review: SprintReviewData
  feedback: SprintFeedbackItem[]
  currentUserId: string
  canManage: boolean
}) {
  const allTasks = [...review.completed, ...review.incomplete]
  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="review-goal" className="rounded-xl border bg-card p-4">
        <h3 id="review-goal" className="font-heading text-sm font-semibold">Sprint goal</h3>
        <p className={cn('mt-1 text-sm', !review.goal && 'text-muted-foreground')}>
          {review.goal || 'No goal was set for this sprint.'}
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <TaskList title="Completed" tasks={review.completed} empty="Nothing finished yet." />
        <TaskList title="Not finished" tasks={review.incomplete} empty="Everything in this sprint is done." />
        <TaskList title="Released" tasks={review.released} empty="Nothing released or ready to release yet." />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="review-qa" className="flex flex-col gap-2 rounded-xl border bg-card p-4">
          <h3 id="review-qa" className="font-heading text-sm font-semibold">Testing (QA) status</h3>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {review.qaCounts.map((q) => (
              <div key={q.status} className="flex flex-col rounded-lg border p-2">
                <dt className="text-2xs text-muted-foreground">{statusLabel(q.status)}</dt>
                <dd className="font-heading text-lg font-semibold tabular-nums">{q.count}</dd>
              </div>
            ))}
          </dl>
        </section>
        <TaskList title="Bugs" tasks={review.bugs} empty="No bugs were logged in this sprint." />
      </div>

      <FeedbackSection
        sprintId={sprintId}
        feedback={feedback}
        tasks={allTasks}
        currentUserId={currentUserId}
        canManage={canManage}
      />
    </div>
  )
}

function FeedbackSection({
  sprintId,
  feedback,
  tasks,
  currentUserId,
  canManage,
}: {
  sprintId: string
  feedback: SprintFeedbackItem[]
  tasks: ReviewTask[]
  currentUserId: string
  canManage: boolean
}) {
  const [body, setBody] = useState('')
  const [taskId, setTaskId] = useState('')
  const [pending, startTransition] = useTransition()
  const [deleting, setDeleting] = useState<string | null>(null)

  function submit() {
    if (!body.trim()) return
    startTransition(async () => {
      try {
        const result = await addFeedback({ sprintId, taskId: taskId || null, body })
        if (result.ok) {
          setBody('')
          setTaskId('')
        } else {
          toast.error(result.error)
        }
      } catch {
        toast.error('Could not reach the server. Your feedback is still here, try again.')
      }
    })
  }

  async function remove(id: string) {
    setDeleting(id)
    try {
      const result = await deleteFeedback(id)
      if (!result.ok) toast.error(result.error)
    } catch {
      toast.error('Could not reach the server, try again')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <section aria-labelledby="review-feedback" className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <h3 id="review-feedback" className="font-heading text-sm font-semibold">Stakeholder feedback</h3>
      {feedback.length === 0 ? (
        <p className="text-sm text-muted-foreground">No feedback yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {feedback.map((f) => (
            <li key={f.id} className="flex flex-col gap-1 rounded-lg border p-3">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-medium">{f.authorName}</span>
                <time dateTime={new Date(f.createdAt).toISOString()} className="text-xs text-muted-foreground">
                  {formatDistanceToNow(f.createdAt, { addSuffix: true })}
                </time>
                {f.authorId === currentUserId || canManage ? (
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    className="ml-auto"
                    disabled={deleting === f.id}
                    onClick={() => void remove(f.id)}
                    aria-label={`Delete feedback from ${f.authorName}`}
                  >
                    {deleting === f.id ? 'Deleting…' : 'Delete'}
                  </Button>
                ) : null}
              </div>
              {f.task ? (
                <p className="text-2xs text-muted-foreground">
                  About {f.task.taskKey ? <span className="font-mono">{f.task.taskKey}</span> : null} {f.task.title}
                </p>
              ) : null}
              <p className="whitespace-pre-wrap text-sm">{f.body}</p>
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex flex-col gap-2 border-t pt-3"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <Label htmlFor="feedback-body">Add feedback</Label>
        <Textarea
          id="feedback-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="What did you think of what the team showed?"
          maxLength={2000}
          rows={3}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="feedback-task">About (optional)</Label>
            <select
              id="feedback-task"
              value={taskId}
              onChange={(event) => setTaskId(event.target.value)}
              className={cn(selectTriggerClassName, 'h-8 w-full max-w-sm')}
            >
              <option value="">The sprint in general</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.taskKey ? `${t.taskKey} ` : ''}
                  {t.title}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" size="sm" disabled={pending || !body.trim()}>
            {pending ? 'Posting…' : 'Post feedback'}
          </Button>
        </div>
      </form>
    </section>
  )
}
