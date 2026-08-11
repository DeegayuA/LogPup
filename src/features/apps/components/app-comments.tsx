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
      const result = await postAppComment(appId, text)
      if (result.ok) {
        setBody('')
        router.refresh()
      } else {
        toast.error(result.error)
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
      <h3 className="font-heading text-sm font-semibold">Discussion</h3>

      <ul className="flex flex-col gap-4">
        {comments.length === 0 ? (
          <li className="text-sm text-muted-foreground">
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
