'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { DownloadIcon, Loader2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { exportWorkspaceBackup } from '@/features/admin/danger-actions'
import { backupSummary, formatBytes } from '@/features/admin/danger-logic'
import { BlastRadiusLists } from '@/features/admin/components/danger-confirm-control'

/**
 * First control on the page because it is the one you run BEFORE the others.
 *
 * No typed confirmation: the phrase discipline exists to stop an irreversible
 * act happening by accident, and this one writes nothing. It is still on the
 * danger page, and still logged, because a single file containing every row in
 * the workspace is what an exfiltration looks like.
 *
 * The file arrives as base64 in the action's result and is turned into a Blob
 * here rather than served from a route: the snapshot is built per request from
 * live tables, so there is nothing at a URL to link to, and a route would mean
 * a second capability gate to keep in step with this one.
 */
export function DangerBackupCard() {
  const [pending, start] = useTransition()
  const [lastSize, setLastSize] = useState<number | null>(null)

  function download() {
    start(async () => {
      try {
        const res = await exportWorkspaceBackup()
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        const bytes = Uint8Array.from(atob(res.data.base64), (ch) => ch.charCodeAt(0))
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }))
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = res.data.filename
        anchor.click()
        // Revoked on the next tick, not immediately: Safari reads the href
        // after the click handler returns, and revoking synchronously gives a
        // silently empty file.
        setTimeout(() => URL.revokeObjectURL(url), 0)
        setLastSize(res.data.byteSize)
        toast.success(`Backup downloaded — ${res.data.filename}`)
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  return (
    <section
      aria-labelledby="danger-backup-title"
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
    >
      <h4 id="danger-backup-title" className="font-heading text-sm font-semibold">
        Export workspace backup
      </h4>
      <p className="text-sm text-muted-foreground">
        Every row in the workspace — people, projects, sprints, tasks, meetings and their
        AI write-ups — as one AES-256-GCM encrypted file. Password hashes and Google
        refresh tokens are deliberately left out, so the file cannot be used to
        impersonate anyone. Decrypting it needs{' '}
        <span className="font-mono text-xs text-foreground">BACKUP_ENCRYPTION_KEY</span>.
      </p>

      <BlastRadiusLists radius={backupSummary()} />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" disabled={pending} onClick={download}>
          {pending ? (
            <Loader2Icon className="animate-spin" aria-hidden />
          ) : (
            <DownloadIcon aria-hidden />
          )}
          {pending ? 'Building…' : 'Download backup'}
        </Button>
        {lastSize !== null && (
          <span className="font-mono text-2xs tabular-nums text-muted-foreground">
            {formatBytes(lastSize)} encrypted
          </span>
        )}
      </div>
    </section>
  )
}
