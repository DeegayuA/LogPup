'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MessagesSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { discuss } from '@/features/chat/actions'

/**
 * "Discuss" on a task, doc page or bug: opens (making it on first use) the
 * one conversation attached to that item, so talk about the work stays with
 * the work (PRD Module D, contextual communication). type="button" because
 * the task dialog renders it inside its <form>.
 */
export function DiscussButton({
  type,
  id,
  label = 'Discuss',
  size = 'sm',
}: {
  type: 'task' | 'doc' | 'bug'
  id: string
  label?: string
  size?: 'xs' | 'sm'
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function onClick() {
    if (busy) return
    setBusy(true)
    try {
      const result = await discuss({ type, id })
      if (result.ok) router.push(`/chat?c=${result.data.channelId}`)
      else toast.error(result.error)
    } catch {
      toast.error('Something went wrong — try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button type="button" size={size} variant="outline" disabled={busy} onClick={() => void onClick()}>
      <MessagesSquare aria-hidden />
      {busy ? 'Opening…' : label}
    </Button>
  )
}
