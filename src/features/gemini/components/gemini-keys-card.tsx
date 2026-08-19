'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CreditCard, KeyRound, Pause, Play, Plus, Trash2, Users } from 'lucide-react'
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
import {
  addGeminiKey,
  deleteGeminiKey,
  setGeminiKeySharing,
  setGeminiKeyTier,
  toggleGeminiKey,
} from '@/features/gemini/actions'
import type { GeminiKeyRow } from '@/features/gemini/queries'

export function GeminiKeysCard({
  keys,
  usedBy,
}: {
  keys: GeminiKeyRow[]
  usedBy: { keyId: string | null; callerName: string; calls: number }[]
}) {
  const [isPending, startTransition] = useTransition()
  const [label, setLabel] = useState('')
  const [key, setKey] = useState('')
  const [tier, setTier] = useState<'free' | 'paid'>('free')

  function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    if (!key.trim() || isPending) return
    startTransition(async () => {
      try {
        const res = await addGeminiKey(label, key, { tier })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Gemini key added')
        setLabel('')
        setKey('')
        setTier('free')
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
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  function handleShare(id: string, shared: boolean) {
    startTransition(async () => {
      try {
        const res = await setGeminiKeySharing(id, shared)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(shared ? 'Key shared with the org' : 'Key is personal again')
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  function handleTier(id: string, tier: 'free' | 'paid') {
    startTransition(async () => {
      try {
        const res = await setGeminiKeyTier(id, tier)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(tier === 'paid' ? 'Marked as paid tier' : 'Marked as free tier')
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
          Your personal keys power every AI feature. Google&rsquo;s free-tier limits are per
          <strong> project</strong>, not per key — to actually multiply your free quota, create
          each key in its own project in Google AI Studio. Keys are encrypted at rest and never
          shown again after saving.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {keys.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No keys yet. Create a free key in Google AI Studio (aistudio.google.com), then
            paste it here to unlock meeting intelligence. Each key from a separate project
            multiplies your free quota.
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
                <Badge variant="outline">{row.tier === 'paid' ? 'Paid' : 'Free'}</Badge>
                {row.shared ? <Badge variant="secondary">Shared</Badge> : null}
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
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    type="button"
                    disabled={isPending}
                    onClick={() => handleTier(row.id, row.tier === 'paid' ? 'free' : 'paid')}
                  >
                    <CreditCard />
                    <span className="sr-only">
                      {row.tier === 'paid' ? 'Mark key as free tier' : 'Mark key as paid tier'}
                    </span>
                  </Button>
                  {row.shared ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      type="button"
                      disabled={isPending}
                      onClick={() => handleShare(row.id, false)}
                    >
                      <Users />
                      <span className="sr-only">Stop sharing key</span>
                    </Button>
                  ) : (
                    <AlertDialog>
                      <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
                        <Users />
                        <span className="sr-only">Share key with org</span>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Share this key with everyone here?</AlertDialogTitle>
                          {/* Consent has two sides and this dialog used to
                              show one. Outbound: what teammates can spend.
                              INBOUND: their meeting audio and screen
                              keyframes land in the OWNER's Google project and
                              are retained there — a data-custody obligation
                              the owner would otherwise accept without being
                              told. Callers get the reciprocal sentence on the
                              Settings AI features card. */}
                          <AlertDialogDescription>
                            Anyone in this LogPup org can spend &ldquo;{row.label}&rdquo;
                            (••••{row.last4}) on their own AI features once their own keys are
                            exhausted. Their meeting recordings and screen keyframes are then
                            uploaded into your Google Cloud project, which retains them via
                            Gemini&rsquo;s Files API for about 48 hours.{' '}
                            {row.tier === 'paid'
                              ? 'On the paid tier, Google does not use prompts to improve its products — but their usage is billed to your account.'
                              : 'On the free tier, Google uses prompts to improve its products.'}{' '}
                            You can see who used it, and you can stop sharing or delete the key
                            at any time.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            disabled={isPending}
                            onClick={() => handleShare(row.id, true)}
                          >
                            Share key
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
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
                {/* The one thing that materially changes when a key is paid,
                    stated on the paid key itself: free-tier prompts feed
                    Google's product improvement, paid-tier ones do not. Said
                    here rather than once per card because it is a property of
                    THIS key — a card can hold both tiers at once. */}
                {row.tier === 'paid' ? (
                  <p className="w-full text-xs text-muted-foreground">
                    Paid tier: Google does not use prompts or responses sent with this key to
                    improve its products.
                  </p>
                ) : null}
                {row.shared && usedBy.some((u) => u.keyId === row.id) ? (
                  <p className="w-full text-xs text-muted-foreground">
                    Used in the last 30 days by{' '}
                    {usedBy
                      .filter((u) => u.keyId === row.id)
                      .map((u) => `${u.callerName} (${u.calls} call${u.calls === 1 ? '' : 's'})`)
                      .join(', ')}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {keys.length === 1 &&
        keys[0].failCount > 0 &&
        keys[0].lastUsedAt !== null &&
        Date.now() - keys[0].lastUsedAt.getTime() < 12 * 60 * 60 * 1000 ? (
          <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            Your only key has been hitting its limits. One key = one project&rsquo;s quota — add
            a second key from a new AI Studio project to keep AI features flowing.
          </p>
        ) : null}

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
          <fieldset className="flex items-center gap-4 text-sm">
            <legend className="sr-only">Key tier</legend>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="gemini-key-tier"
                checked={tier === 'free'}
                onChange={() => setTier('free')}
              />
              Free tier
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="gemini-key-tier"
                checked={tier === 'paid'}
                onChange={() => setTier('paid')}
              />
              Paid (billing linked)
            </label>
          </fieldset>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Free keys cost $0 and cover every LogPup feature (roughly 10&ndash;15 requests/min
              and a few hundred/day per project). One key per AI Studio project; add up to 5.
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
