'use client'

import { useTransition } from 'react'
import { Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { exportSprintToNotion } from '@/features/notion/actions'

export function ExportButton({ sprintId }: { sprintId: string }) {
  const [isPending, startTransition] = useTransition()

  function handleExport() {
    startTransition(async () => {
      try {
        const res = await exportSprintToNotion(sprintId)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        const pageUrl = res.data.pageUrl
        toast.success('Exported to Notion', {
          action: {
            label: 'Open in Notion',
            onClick: () => window.open(pageUrl, '_blank', 'noopener,noreferrer'),
          },
        })
      } catch {
        toast.error('Notion export failed — check token and parent page sharing')
      }
    })
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={isPending}>
      {isPending ? <Loader2 className="animate-spin" /> : <Send />}
      {isPending ? 'Exporting…' : 'Export to Notion'}
    </Button>
  )
}
