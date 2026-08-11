'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { KeyRound, Pause, Play, Plus, Trash2 } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { addGeminiKey, deleteGeminiKey, toggleGeminiKey } from '@/features/gemini/actions'
import type { GeminiKeyRow } from '@/features/gemini/queries'

export function GeminiKeysCard({ keys }: { keys: GeminiKeyRow[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [label, setLabel] = useState('')
  const [key, setKey] = useState('')

  function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    if (!key.trim() || isPending) return
    startTransition(async () => {
      try {
        const res = await addGeminiKey(label, key)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Gemini key added')
        setLabel('')
        setKey('')
        router.refresh()
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  function handleToggle(id: string, active: boolean) {
    startTransition(async () => {
      try {
        const res = await toggleGeminiKey(id, active)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(active ? 'Key resumed' : 'Key paused')
        router.refresh()
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        const res = await deleteGeminiKey(id)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Key removed')
        router.refresh()
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  return (
    <Card id="gemini">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading">
          <KeyRound className="size-4" aria-hidden /> Gemini API keys
        </CardTitle>
        <CardDescription>
          Your personal keys power meeting transcription and AI notes. Requests roll across
          your active keys automatically, so adding more keys spreads out free-tier rate
          limits. Keys are encrypted at rest and never shown again after saving.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {keys.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No keys yet. Create a free key in Google AI Studio (aistudio.google.com), then
            paste it here to unlock meeting intelligence.
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {keys.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{row.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    ••••{row.last4}
                    {row.failCount > 0 ? (
                      <span className="ml-2 text-destructive">
                        {row.failCount} recent failure{row.failCount === 1 ? '' : 's'}
                      </span>
                    ) : null}
                  </span>
                </div>
                <Badge variant={row.active ? 'default' : 'secondary'}>
                  {row.active ? 'Active' : 'Paused'}
                </Badge>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    type="button"
                    disabled={isPending}
                    onClick={() => handleToggle(row.id, !row.active)}
                  >
                    {row.active ? <Pause /> : <Play />}
                    <span className="sr-only">{row.active ? 'Pause key' : 'Resume key'}</span>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
                      <Trash2 />
                      <span className="sr-only">Remove key</span>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove this key?</AlertDialogTitle>
                        <AlertDialogDescription>
                          &ldquo;{row.label}&rdquo; (••••{row.last4}) will stop being used for
                          AI features. The key itself stays valid in Google AI Studio.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          disabled={isPending}
                          onClick={() => handleDelete(row.id)}
                        >
                          Remove key
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleAdd} className="flex flex-col gap-3 rounded-lg border p-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gemini-key-label">Label</Label>
              <Input
                id="gemini-key-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Personal key"
                maxLength={60}
                className="h-9"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gemini-key-value">API key</Label>
              <Input
                id="gemini-key-value"
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                autoComplete="off"
                required
                className="h-9 font-mono"
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Free tier is per-key (roughly 5–15 requests/min and a few hundred requests/day
              depending on model — see ai.google.dev/rate-limits). Add up to 5 keys.
            </p>
            <Button type="submit" size="sm" disabled={isPending || !key.trim()}>
              <Plus /> {isPending ? 'Checking…' : 'Add key'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
