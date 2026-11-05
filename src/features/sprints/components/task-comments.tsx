'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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
import { MentionText, MentionTextarea } from '@/components/mention-textarea'
import {
  addTaskComment,
  deleteTaskComment,
  editTaskComment,
  listTaskComments,
  type TaskComment,
  type TaskCommentThread,
} from '@/features/sprints/task-comments-actions'

/**
 * The discussion thread inside the task dialog.
 *
 * RENDERED INSIDE THE DIALOG'S <form>, which shapes everything below: there is
 * no nested <form> (invalid HTML, and its submit would bubble into the task
 * save), every button is type="button", and the keyboard shortcuts stop
 * propagation so ⌘/Ctrl+Enter posts the comment rather than saving the task,
 * and Escape cancels an edit rather than closing the dialog.
 *
 * API-skill choices: optimistic add/edit/delete with rollback; request dedup
 * (a generation counter drops stale responses, a pending guard stops a double
 * post); SWR-style revalidate on window focus so a colleague's reply shows up
 * without a reload. No polling — a thread inside a modal is open for minutes,
 * and focus revalidation covers the "came back to it" case without a timer.
 * Streaming and preloading do not fit a single small list fetched on open.
 */

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready' }

let optimisticSeq = 0

export function TaskComments({ taskId, canComment }: { taskId: string; canComment: boolean }) {
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [thread, setThread] = useState<TaskCommentThread | null>(null)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const generation = useRef(0)
  const [shownTask, setShownTask] = useState(taskId)

  // A different task reuses this instance when the dialog is not re-keyed:
  // reset during render (React's documented pattern for prop-driven resets)
  // rather than in the effect, so the previous task's thread never flashes.
  if (shownTask !== taskId) {
    setShownTask(taskId)
    setThread(null)
    setDraft('')
    setLoad({ status: 'loading' })
  }

  // `silent` revalidations (focus) keep the current list on screen and never
  // replace it with a skeleton or an error — stale-while-revalidate. Every
  // state write sits in a .then callback, never synchronously in the effect;
  // the skeleton for a non-silent load is either the initial state or set by
  // the Retry handler itself. The rejection branch exists because a server
  // action can still reject on transport failure (offline, deploy mid-flight).
  const fetchThread = useCallback(
    (silent: boolean) => {
      const mine = ++generation.current
      listTaskComments(taskId).then(
        (result) => {
          if (mine !== generation.current) return
          if (result.ok) {
            setThread(result.data)
            setLoad({ status: 'ready' })
          } else if (!silent) {
            setLoad({ status: 'error', message: result.error })
          }
        },
        () => {
          if (mine !== generation.current || silent) return
          setLoad({ status: 'error', message: 'Could not reach the server' })
        },
      )
    },
    [taskId],
  )

  useEffect(() => {
    const gen = generation
    fetchThread(false)
    const onFocus = () => {
      if (document.visibilityState === 'visible') fetchThread(true)
    }
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      // Any response still in flight belongs to a closed dialog (or another task).
      gen.current++
    }
  }, [fetchThread])

  function retry() {
    setLoad({ status: 'loading' })
    fetchThread(false)
  }

  function setComments(update: (comments: TaskComment[]) => TaskComment[]) {
    setThread((current) => (current ? { ...current, comments: update(current.comments) } : current))
  }

  async function post() {
    const text = draft.trim()
    if (!text || posting || !thread) return
    const tempId = `optimistic-${++optimisticSeq}`
    const optimistic: TaskComment = {
      id: tempId,
      body: text,
      createdAt: new Date(),
      editedAt: null,
      authorId: thread.viewer.id,
      authorName: thread.viewer.name,
      authorAvatarUrl: thread.viewer.avatarUrl,
      mine: true,
    }
    setPosting(true)
    setComments((comments) => [...comments, optimistic])
    // Invalidate any focus revalidation already in flight: it was issued
    // before this comment existed and would wipe the optimistic row.
    generation.current++
    setDraft('')
    try {
      const result = await addTaskComment(taskId, text)
      if (result.ok) {
        setComments((comments) => comments.map((c) => (c.id === tempId ? result.data.comment : c)))
        if (result.data.mentionAdvisory) toast.warning(result.data.mentionAdvisory)
      } else {
        rollbackPost(tempId, text)
        toast.error(result.error)
      }
    } catch {
      rollbackPost(tempId, text)
      toast.error('Could not reach the server — your comment is still here, try again')
    } finally {
      setPosting(false)
    }
  }

  // The typed text goes back into the composer: losing what someone wrote
  // because the network blinked is the one failure a comment box must not have.
  function rollbackPost(tempId: string, text: string) {
    setComments((comments) => comments.filter((c) => c.id !== tempId))
    setDraft((current) => (current.trim() ? current : text))
  }

  async function saveEdit(comment: TaskComment, body: string): Promise<boolean> {
    const text = body.trim()
    if (!text) return false
    const previous = comment
    generation.current++
    setComments((comments) =>
      comments.map((c) => (c.id === comment.id ? { ...c, body: text, editedAt: new Date() } : c)),
    )
    try {
      const result = await editTaskComment(comment.id, text)
      if (result.ok) {
        setComments((comments) =>
          comments.map((c) => (c.id === comment.id ? { ...c, editedAt: result.data.editedAt } : c)),
        )
        if (result.data.mentionAdvisory) toast.warning(result.data.mentionAdvisory)
        return true
      }
      toast.error(result.error)
    } catch {
      toast.error('Could not reach the server — try again')
    }
    setComments((comments) => comments.map((c) => (c.id === comment.id ? previous : c)))
    return false
  }

  async function remove(comment: TaskComment) {
    const index = thread?.comments.findIndex((c) => c.id === comment.id) ?? -1
    generation.current++
    setComments((comments) => comments.filter((c) => c.id !== comment.id))
    try {
      const result = await deleteTaskComment(comment.id)
      if (result.ok) return
      toast.error(result.error)
    } catch {
      toast.error('Could not reach the server — try again')
    }
    // Back in its original place, not appended — the thread is chronological.
    setComments((comments) => {
      if (comments.some((c) => c.id === comment.id)) return comments
      const next = [...comments]
      next.splice(index < 0 ? next.length : Math.min(index, next.length), 0, comment)
      return next
    })
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // A half-written comment survives Escape: it must not close the dialog.
    if (event.key === 'Escape' && draft.trim() !== '') {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      void post()
    }
  }

  const count = thread?.comments.length ?? 0

  return (
    <section aria-labelledby={`task-comments-${taskId}`} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={`task-comments-${taskId}`} className="font-heading text-sm font-semibold">
          Comments
        </h3>
        {load.status === 'ready' ? (
          <span className="font-mono text-2xs text-muted-foreground tabular-nums">
            {count} {count === 1 ? 'comment' : 'comments'}
          </span>
        ) : null}
      </div>

      {load.status === 'loading' ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading comments">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="size-6 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : load.status === 'error' ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground"
        >
          <span>Couldn’t load comments — {load.message}.</span>
          <Button type="button" size="sm" variant="outline" onClick={retry}>
            Retry
          </Button>
        </div>
      ) : thread ? (
        <ul className="flex flex-col gap-4" aria-label="Comments">
          {thread.comments.length === 0 ? (
            <li className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No comments yet.
            </li>
          ) : (
            thread.comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                thread={thread}
                onSave={saveEdit}
                onDelete={remove}
              />
            ))
          )}
        </ul>
      ) : null}

      {canComment && load.status === 'ready' && thread?.canComment ? (
        <div className="flex flex-col gap-2">
          <MentionTextarea
            users={thread.mentionUsers}
            value={draft}
            onValueChange={setDraft}
            onKeyDown={handleComposerKeyDown}
            rows={3}
            maxLength={4000}
            placeholder="Write a comment… use @ to mention a teammate"
            aria-label="Write a comment"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">⌘/Ctrl + Enter to post</span>
            <Button type="button" size="sm" onClick={() => void post()} disabled={posting || !draft.trim()}>
              {posting ? 'Posting…' : 'Comment'}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function CommentItem({
  comment,
  thread,
  onSave,
  onDelete,
}: {
  comment: TaskComment
  thread: TaskCommentThread
  onSave: (comment: TaskComment, body: string) => Promise<boolean>
  onDelete: (comment: TaskComment) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(comment.body)
  const [saving, setSaving] = useState(false)
  const pendingRow = comment.id.startsWith('optimistic-')
  const canDelete = !pendingRow && (comment.mine || thread.canModerate)

  async function save() {
    if (saving || !text.trim()) return
    setSaving(true)
    const saved = await onSave(comment, text)
    setSaving(false)
    if (saved) setEditing(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      void save()
    } else if (event.key === 'Escape') {
      // Cancel the edit, not the whole dialog.
      event.preventDefault()
      event.stopPropagation()
      setEditing(false)
      setText(comment.body)
    }
  }

  return (
    <li className="flex gap-3" aria-busy={pendingRow || undefined}>
      <Avatar size="sm">
        {comment.authorAvatarUrl ? (
          <AvatarImage src={comment.authorAvatarUrl} alt="" />
        ) : null}
        <AvatarFallback>{comment.authorName.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-medium">{comment.authorName}</span>
          <time
            dateTime={new Date(comment.createdAt).toISOString()}
            className="text-xs text-muted-foreground"
          >
            {pendingRow ? 'Posting…' : formatDistanceToNow(comment.createdAt, { addSuffix: true })}
          </time>
          {comment.editedAt ? (
            <span className="text-xs text-muted-foreground" title={new Date(comment.editedAt).toLocaleString()}>
              (edited)
            </span>
          ) : null}
          {!editing && (comment.mine || canDelete) && !pendingRow ? (
            <span className="ml-auto flex items-center gap-1">
              {comment.mine ? (
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    setText(comment.body)
                    setEditing(true)
                  }}
                >
                  Edit
                </Button>
              ) : null}
              {canDelete ? (
                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        aria-label={`Delete comment by ${comment.authorName}`}
                      />
                    }
                  >
                    Delete
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {comment.mine
                          ? 'It disappears from the thread for everyone.'
                          : `This removes ${comment.authorName}’s comment from the thread for everyone.`}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        type="button"
                        variant="destructive"
                        onClick={() => void onDelete(comment)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
            </span>
          ) : null}
        </div>
        {editing ? (
          <div className="mt-1 flex flex-col gap-2">
            <MentionTextarea
              users={thread.mentionUsers}
              value={text}
              onValueChange={setText}
              onKeyDown={handleKeyDown}
              rows={3}
              maxLength={4000}
              autoFocus
              aria-label="Edit comment"
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false)
                  setText(comment.body)
                }}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={() => void save()} disabled={saving || !text.trim()}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        ) : (
          <MentionText
            text={comment.body}
            users={thread.mentionUsers}
            className="block text-sm whitespace-pre-wrap break-words"
          />
        )}
      </div>
    </li>
  )
}
