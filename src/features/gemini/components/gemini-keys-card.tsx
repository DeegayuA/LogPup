'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  addGeminiKey,
  deleteGeminiKey,
  setGeminiKeySharing,
  setGeminiKeyTier,
  toggleGeminiKey,
} from '@/features/gemini/actions'
import type { GeminiKeyRow } from '@/features/gemini/queries'
import type { ActionResult } from '@/lib/action-result'

type UsedByRow = { keyId: string | null; callerName: string; calls: number }

/**
 * The key CRUD card. Lives on /settings (id="gemini") so the whole AI setup
 * loop — readiness verdict, the keys that fix it, the per-feature switches —
 * reads top to bottom on one page; /profile#gemini keeps a pointer stub for
 * old deep links (meeting-intel still emits one).
 *
 * The key actions revalidate '/profile' (their historical home) and cannot be
 * edited from here, so every successful mutation also calls router.refresh():
 * without it the card would show stale rows on /settings right after a write.
 */
export function GeminiKeysCard({
  keys,
  usedBy,
}: {
  keys: GeminiKeyRow[]
  usedBy: UsedByRow[]
}) {
  const router = useRouter()
  const [isAdding, startAdding] = useTransition()
  const [label, setLabel] = useState('')
  const [key, setKey] = useState('')
  const [tier, setTier] = useState<'free' | 'paid'>('free')
  // Frozen at mount rather than read per render: this only decides whether a
  // 12-hour-old failure still counts as news, and a value that shifted on
  // every re-render is exactly what react-hooks/purity exists to prevent.
  const [nowMs] = useState(() => Date.now())

  function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    if (!key.trim() || isAdding) return
    startAdding(async () => {
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
        router.refresh()
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  return (
    <Card id="gemini" className="scroll-mt-20">
      <CardHeader>
        <CardTitle as="h2" className="flex items-center gap-2 font-heading">
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
          <EmptyState
            icon={KeyRound}
            title="No keys yet."
            description="Create a free key in Google AI Studio, then paste it below to unlock meeting intelligence. Each key from a separate project multiplies your free quota."
            action={
              <Button
                variant="outline"
                size="sm"
                render={
                  <a
                    href="https://aistudio.google.com"
                    target="_blank"
                    rel="noreferrer noopener"
                  />
                }
              >
                Open Google AI Studio
              </Button>
            }
            className="rounded-xl border border-dashed border-border"
          />
        ) : (
          <TooltipProvider>
            <ul className="flex flex-col divide-y">
              {keys.map((row) => (
                <GeminiKeyRowItem
                  key={row.id}
                  row={row}
                  usedBy={usedBy.filter((u) => u.keyId === row.id)}
                />
              ))}
            </ul>
          </TooltipProvider>
        )}

        {keys.length === 1 &&
        keys[0].failCount > 0 &&
        keys[0].lastUsedAt !== null &&
        nowMs - keys[0].lastUsedAt.getTime() < 12 * 60 * 60 * 1000 ? (
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
          <RadioGroup
            aria-label="Key tier"
            value={tier}
            onValueChange={(next) => setTier(next as 'free' | 'paid')}
            className="flex flex-row flex-wrap items-center gap-4"
          >
            <Label className="flex items-center gap-2 font-normal">
              <RadioGroupItem value="free" /> Free tier
            </Label>
            <Label className="flex items-center gap-2 font-normal">
              <RadioGroupItem value="paid" /> Paid (billing linked)
            </Label>
          </RadioGroup>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Free keys cost $0 and cover every LogPup feature (roughly 10&ndash;15 requests/min
              and a few hundred/day per project). One key per AI Studio project; add up to 5.
            </p>
            <Button
              type="submit"
              size="sm"
              className="self-start sm:self-auto"
              disabled={isAdding || !key.trim()}
            >
              <Plus /> {isAdding ? 'Checking…' : 'Add key'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

/**
 * One key row with ITS OWN pending state: pausing one key must not freeze the
 * delete button on another. Within a row the actions still share a single
 * transition — two writes to the same key racing each other has no good
 * answer, so serializing per row is the honest granularity.
 */
function GeminiKeyRowItem({ row, usedBy }: { row: GeminiKeyRow; usedBy: UsedByRow[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function act(action: () => Promise<ActionResult>, success: string) {
    startTransition(async () => {
      try {
        const res = await action()
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(success)
        router.refresh()
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  const nextTier = row.tier === 'paid' ? 'free' : 'paid'

  return (
    <li className="flex flex-wrap items-center gap-3 py-2.5">
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
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                type="button"
                disabled={isPending}
                onClick={() =>
                  act(
                    () => toggleGeminiKey(row.id, !row.active),
                    row.active ? 'Key paused' : 'Key resumed',
                  )
                }
              />
            }
          >
            {row.active ? <Pause /> : <Play />}
            <span className="sr-only">{row.active ? 'Pause key' : 'Resume key'}</span>
          </TooltipTrigger>
          <TooltipContent>{row.active ? 'Pause key' : 'Resume key'}</TooltipContent>
        </Tooltip>

        {/* Tier flips are consequential in both directions — "paid" governs
            what models rotation may try and whose bill usage lands on — so
            the flip confirms like share/delete do, instead of firing on a
            28px mis-tap. */}
        <AlertDialog>
          <Tooltip>
            <TooltipTrigger
              render={
                <AlertDialogTrigger
                  render={<Button variant="ghost" size="icon" type="button" />}
                />
              }
            >
              <CreditCard />
              <span className="sr-only">
                {row.tier === 'paid' ? 'Mark key as free tier' : 'Mark key as paid tier'}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {row.tier === 'paid' ? 'Mark as free tier' : 'Mark as paid tier'}
            </TooltipContent>
          </Tooltip>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {nextTier === 'paid'
                  ? 'Mark this key as paid tier?'
                  : 'Mark this key as free tier?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {nextTier === 'paid' ? (
                  <>
                    &ldquo;{row.label}&rdquo; (••••{row.last4}) will be treated as having
                    billing linked in Google AI Studio: paid-only models can run on it, that
                    usage is billed to its Google account, and Google does not use paid-tier
                    prompts to improve its products. Only mark it paid if billing really is
                    linked — otherwise paid-only calls keep failing.
                  </>
                ) : (
                  <>
                    &ldquo;{row.label}&rdquo; (••••{row.last4}) will be treated as a free key:
                    paid-only models stop being tried on it, it is charged $0, and Google uses
                    free-tier prompts to improve its products.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={isPending}
                onClick={() =>
                  act(
                    () => setGeminiKeyTier(row.id, nextTier),
                    nextTier === 'paid' ? 'Marked as paid tier' : 'Marked as free tier',
                  )
                }
              >
                {nextTier === 'paid' ? 'Mark as paid' : 'Mark as free'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {row.shared ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    act(() => setGeminiKeySharing(row.id, false), 'Key is personal again')
                  }
                />
              }
            >
              <Users />
              <span className="sr-only">Stop sharing key</span>
            </TooltipTrigger>
            <TooltipContent>Stop sharing key</TooltipContent>
          </Tooltip>
        ) : (
          <AlertDialog>
            <Tooltip>
              <TooltipTrigger
                render={
                  <AlertDialogTrigger
                    render={<Button variant="ghost" size="icon" type="button" />}
                  />
                }
              >
                <Users />
                <span className="sr-only">Share key with org</span>
              </TooltipTrigger>
              <TooltipContent>Share key with org</TooltipContent>
            </Tooltip>
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
                  onClick={() =>
                    act(() => setGeminiKeySharing(row.id, true), 'Key shared with the org')
                  }
                >
                  Share key
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        <AlertDialog>
          <Tooltip>
            <TooltipTrigger
              render={
                <AlertDialogTrigger
                  render={<Button variant="ghost" size="icon" type="button" />}
                />
              }
            >
              <Trash2 />
              <span className="sr-only">Remove key</span>
            </TooltipTrigger>
            <TooltipContent>Remove key</TooltipContent>
          </Tooltip>
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
                onClick={() => act(() => deleteGeminiKey(row.id), 'Key removed')}
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
      {row.shared && usedBy.length > 0 ? (
        <p className="w-full text-xs text-muted-foreground">
          Used in the last 30 days by{' '}
          {usedBy
            .map((u) => `${u.callerName} (${u.calls} call${u.calls === 1 ? '' : 's'})`)
            .join(', ')}
        </p>
      ) : null}
    </li>
  )
}
