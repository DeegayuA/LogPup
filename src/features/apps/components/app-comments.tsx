'use client'

import { useState, useTransition, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { MentionTextarea, type MentionUser } from '@/components/mention-textarea'
import { postAppComment } from '@/features/apps/comment-actions'
import type { AppComment } from '@/features/apps/comment-queries'

export function AppComments({
  appId,
  comments,
  users,
}: {
  appId: string
  comments: AppComment[]
  users: MentionUser[]
}) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [pending, startTransition] = useTransition()

  function submit() {
    const text = body.trim()
    if (!text || pending) return
    startTransition(async () => {
      try {
        const result = await postAppComment(appId, text)
        if (result.ok) {
          // Cleared only on success. Losing what someone typed because the
          // network blinked is the one failure mode a comment box must not
          // have — the text stays in the textarea and Comment stays enabled.
          setBody('')
          router.refresh()
        } else {
          toast.error(result.error)
        }
      } catch {
        // `postAppComment` returns err() for everything it can foresee, but a
        // server action can still reject on a transport failure (offline, a
        // deploy mid-flight). Without this the rejection is unhandled: the
        // button silently un-disables and nothing tells the user why.
        toast.error('Could not reach the server — your comment is still here, try again')
      }
    })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      submit()
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        {/* h2, not h3: this is now a whole page section sitting directly
            under the app's h1, not a card inside the Overview tab. */}
        <h2 className="font-heading text-sm font-semibold">Discussion</h2>
        <span className="font-mono text-2xs text-muted-foreground tabular-nums">
          {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
        </span>
      </div>

      <ul className="flex flex-col gap-4">
        {comments.length === 0 ? (
          <li className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No comments yet. Start the conversation — type <span className="font-medium">@</span> to
            mention a teammate and notify them.
          </li>
        ) : (
          comments.map((comment) => (
            <li key={comment.id} className="flex gap-3">
              <Avatar size="sm">
                {comment.authorAvatarUrl ? (
                  <AvatarImage src={comment.authorAvatarUrl} alt={comment.authorName} />
                ) : null}
                <AvatarFallback>{comment.authorName.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium">{comment.authorName}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">{comment.body}</p>
              </div>
            </li>
          ))
        )}
      </ul>

      <div className="flex flex-col gap-2">
        <MentionTextarea
          users={users}
          value={body}
          onValueChange={setBody}
          onKeyDown={handleKeyDown}
          rows={3}
          placeholder="Write a comment… use @ to mention a teammate"
          aria-label="Write a comment"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">⌘/Ctrl + Enter to post</span>
          <Button size="sm" onClick={submit} disabled={pending || !body.trim()}>
            {pending ? 'Posting…' : 'Comment'}
          </Button>
        </div>
      </div>
    </div>
  )
}
