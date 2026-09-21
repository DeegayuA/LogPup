'use client'

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Building2, Loader2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchSelect } from '@/components/ui/search-select'
import { CurrencySelect } from '@/components/shared/currency-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { setProjectValue } from '@/features/finance/rate-actions'
import { formatMoney, type ProjectValueRow } from '@/features/finance/rate-intervals'
import type { AssignableApp } from '@/features/people/queries'

// Maps each `.refine` message in setProjectValue's zod schema to the field
// it names, since ActionResult carries only a message string, never a zod
// `path` — the action collapses every issue to `err(issues[0].message)`.
// Keep these three literal strings in sync with rate-actions.ts if its
// refine messages ever change; a mismatch degrades to a top-level alert
// (see `fieldMessage` below), it never throws.
const FIELD_MESSAGES: Record<string, 'subscriptionFrom' | 'subscriptionTo'> = {
  'A subscription needs a start date': 'subscriptionFrom',
  'An end date needs a start date too': 'subscriptionTo',
  'The subscription must end after it starts': 'subscriptionTo',
}

export function RatesProjectCard({
  apps,
  rows,
  headcounts = {},
}: {
  apps: AssignableApp[]
  rows: ProjectValueRow[]
  headcounts?: Record<string, number>
}) {
  const router = useRouter()
  const fieldId = useId()

  const [appId, setAppId] = useState('')
  const [contractValue, setContractValue] = useState('')
  const [subscriptionMode, setSubscriptionMode] = useState<'flat' | 'per_user'>('flat')
  const [subscriptionMonthly, setSubscriptionMonthly] = useState('')
  const [perUserRate, setPerUserRate] = useState('')
  const [userCount, setUserCount] = useState('')
  const [subscriptionFrom, setSubscriptionFrom] = useState('')
  const [subscriptionTo, setSubscriptionTo] = useState('')
  const [currency, setCurrency] = useState('LKR')
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null)
  const [pending, startPending] = useTransition()

  const teamCount = appId ? headcounts[appId] : undefined

  // Picking an app that already has a value prefills the form from its row,
  // so "set" reads as "edit" for the upsert setProjectValue actually does.
  // Driven from the SELECTION EVENT (SearchSelect's onValueChange, the table's
  // Edit button) rather than a useEffect keyed on appId — setState inside an
  // effect body here would just be reacting to a change this component itself
  // caused, one render later, for no benefit.
  function selectApp(id: string) {
    const existing = rows.find((row) => row.appId === id)
    setAppId(id)
    setContractValue(existing?.contractValue ?? '')
    setSubscriptionMonthly(existing?.subscriptionMonthly ?? '')
    setSubscriptionFrom(existing?.subscriptionFrom ?? '')
    setSubscriptionTo(existing?.subscriptionTo ?? '')
    setCurrency(existing?.currency ?? 'LKR')
    setError(null)
    setFieldError(null)

    const count = headcounts[id]
    if (count && count > 0) {
      setUserCount(String(count))
      if (existing?.subscriptionMonthly && Number(existing.subscriptionMonthly) > 0) {
        setPerUserRate((Number(existing.subscriptionMonthly) / count).toFixed(2))
      } else {
        setPerUserRate('')
      }
    } else {
      setUserCount('')
      setPerUserRate('')
    }
  }

  function handlePerUserRateChange(newRate: string) {
    setPerUserRate(newRate)
    const rateNum = Number(newRate)
    const countNum = Number(userCount)
    if (newRate.trim() !== '' && userCount.trim() !== '' && !isNaN(rateNum) && !isNaN(countNum)) {
      setSubscriptionMonthly((rateNum * countNum).toFixed(2))
    }
  }

  function handleUserCountChange(newCount: string) {
    setUserCount(newCount)
    const rateNum = Number(perUserRate)
    const countNum = Number(newCount)
    if (perUserRate.trim() !== '' && newCount.trim() !== '' && !isNaN(rateNum) && !isNaN(countNum)) {
      setSubscriptionMonthly((rateNum * countNum).toFixed(2))
    }
  }

  function handleSwitchToPerUser() {
    setSubscriptionMode('per_user')
    const count = appId ? headcounts[appId] : undefined
    if ((!userCount || userCount === '0') && count && count > 0) {
      setUserCount(String(count))
      if (subscriptionMonthly && Number(subscriptionMonthly) > 0 && !perUserRate) {
        setPerUserRate((Number(subscriptionMonthly) / count).toFixed(2))
      }
    }
  }

  const options = apps.map((app) => ({ value: app.id, label: app.name, hint: app.slug }))
  const valid = appId.length > 0 && /^[A-Za-z]{3}$/.test(currency.trim())

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!valid) return
    setError(null)
    setFieldError(null)

    let finalMonthly: number | null = null
    if (subscriptionMode === 'per_user') {
      const hasRate = perUserRate.trim() !== ''
      const hasCount = userCount.trim() !== ''
      if (hasRate && hasCount) {
        const rateNum = Number(perUserRate)
        const countNum = Number(userCount)
        if (isNaN(rateNum) || rateNum < 0 || isNaN(countNum) || countNum < 0) {
          setError('Rate per user and headcount must be valid non-negative numbers.')
          return
        }
        finalMonthly = Number((rateNum * countNum).toFixed(2))
      } else if (!hasRate && !hasCount) {
        finalMonthly = null
      } else {
        setError('Please provide both rate per user and headcount, or leave both blank.')
        return
      }
    } else {
      finalMonthly = subscriptionMonthly.trim() === '' ? null : Number(subscriptionMonthly)
    }

    startPending(async () => {
      const res = await setProjectValue({
        appId,
        contractValue: contractValue.trim() === '' ? null : Number(contractValue),
        subscriptionMonthly: finalMonthly,
        subscriptionFrom: subscriptionFrom.trim() === '' ? null : subscriptionFrom,
        subscriptionTo: subscriptionTo.trim() === '' ? null : subscriptionTo,
        currency: currency.trim().toUpperCase(),
      })
      if (!res.ok) {
        const field = FIELD_MESSAGES[res.error]
        if (field) setFieldError({ field, message: res.error })
        else setError(res.error)
        return
      }
      toast.success('Project value saved')
      router.refresh()
    })
  }

  function fieldMessage(field: string) {
    return fieldError?.field === field ? fieldError.message : null
  }

  const fromMsg = fieldMessage('subscriptionFrom')
  const toMsg = fieldMessage('subscriptionTo')

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle as="h2">Set project value</CardTitle>
          <CardDescription>
            Contract value and/or a monthly subscription. Leaving an amount blank means
            &quot;not stated&quot;, never zero.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${fieldId}-app`}>Project</Label>
              <SearchSelect
                id={`${fieldId}-app`}
                value={appId}
                onValueChange={selectApp}
                options={options}
                placeholder="Select a project…"
                searchPlaceholder="Type a project name…"
                disabled={pending}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${fieldId}-contract`}>Contract value (optional)</Label>
                <Input
                  id={`${fieldId}-contract`}
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={contractValue}
                  onChange={(event) => setContractValue(event.target.value)}
                  className="h-9 font-mono"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${fieldId}-currency`}>Currency</Label>
                <CurrencySelect
                  id={`${fieldId}-currency`}
                  value={currency}
                  onChange={(next) => setCurrency(next)}
                  disabled={pending}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border border-border/70 p-3 bg-muted/20">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Label className="text-xs font-semibold">Monthly subscription model</Label>
                  <p className="text-2xs text-muted-foreground">
                    Flat rate or calculated per user / per head.
                  </p>
                </div>
                <div
                  role="radiogroup"
                  aria-label="Subscription billing model"
                  className="inline-flex rounded-lg border border-border p-0.5 bg-muted/50 text-xs"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={subscriptionMode === 'flat'}
                    onClick={() => setSubscriptionMode('flat')}
                    className={cn(
                      'px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer',
                      subscriptionMode === 'flat'
                        ? 'bg-background text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Flat monthly
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={subscriptionMode === 'per_user'}
                    onClick={handleSwitchToPerUser}
                    className={cn(
                      'px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer',
                      subscriptionMode === 'per_user'
                        ? 'bg-background text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Per user / per head
                  </button>
                </div>
              </div>

              {subscriptionMode === 'per_user' ? (
                <div className="flex flex-col gap-3 pt-1">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`${fieldId}-per-user-rate`}>Rate per user / head ({currency})</Label>
                      <Input
                        id={`${fieldId}-per-user-rate`}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="e.g. 50"
                        inputMode="decimal"
                        value={perUserRate}
                        onChange={(e) => handlePerUserRateChange(e.target.value)}
                        className="h-9 font-mono"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`${fieldId}-user-count`}>Number of users / heads</Label>
                        {teamCount !== undefined && teamCount > 0 && (
                          <button
                            type="button"
                            onClick={() => handleUserCountChange(String(teamCount))}
                            className="text-2xs text-primary hover:underline font-medium cursor-pointer"
                          >
                            Use team size ({teamCount})
                          </button>
                        )}
                      </div>
                      <Input
                        id={`${fieldId}-user-count`}
                        type="number"
                        step="1"
                        min="0"
                        placeholder="e.g. 8"
                        inputMode="numeric"
                        value={userCount}
                        onChange={(e) => handleUserCountChange(e.target.value)}
                        className="h-9 font-mono"
                      />
                    </div>
                  </div>

                  {/* Real-time calculation feedback */}
                  <div className="flex items-center justify-between rounded-md bg-background/80 px-3 py-2 border border-border/60 text-xs">
                    <span className="text-muted-foreground">Computed monthly subscription:</span>
                    <span className="font-mono font-medium">
                      {perUserRate && userCount && Number(perUserRate) > 0 && Number(userCount) > 0 ? (
                        <>
                          <span className="text-muted-foreground font-normal">
                            {userCount} {Number(userCount) === 1 ? 'user' : 'users'} × {formatMoney(Number(perUserRate), currency)} ={' '}
                          </span>
                          <span className="text-foreground font-semibold">
                            {formatMoney(Number(perUserRate) * Number(userCount), currency)}/mo
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground italic">Enter rate & headcount</span>
                      )}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 pt-1">
                  <Label htmlFor={`${fieldId}-monthly`}>Subscription / month (optional)</Label>
                  <Input
                    id={`${fieldId}-monthly`}
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    placeholder="e.g. 400"
                    value={subscriptionMonthly}
                    onChange={(event) => setSubscriptionMonthly(event.target.value)}
                    className="h-9 font-mono"
                  />
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 pt-1 border-t border-border/40">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${fieldId}-from`}>Subscription from (start date)</Label>
                  <Input
                    id={`${fieldId}-from`}
                    type="date"
                    value={subscriptionFrom}
                    onChange={(event) => setSubscriptionFrom(event.target.value)}
                    aria-invalid={Boolean(fromMsg)}
                    aria-describedby={fromMsg ? `${fieldId}-from-error` : undefined}
                    className="h-9 font-mono"
                  />
                  {fromMsg ? (
                    <p id={`${fieldId}-from-error`} role="alert" className="text-2xs text-destructive">
                      {fromMsg}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`${fieldId}-to`}>Subscription to (end date)</Label>
                    <span className="text-2xs text-muted-foreground">Optional</span>
                  </div>
                  <Input
                    id={`${fieldId}-to`}
                    type="date"
                    value={subscriptionTo}
                    onChange={(event) => setSubscriptionTo(event.target.value)}
                    aria-invalid={Boolean(toMsg)}
                    aria-describedby={toMsg ? `${fieldId}-to-error` : undefined}
                    className="h-9 font-mono"
                  />
                  {toMsg ? (
                    <p id={`${fieldId}-to-error`} role="alert" className="text-2xs text-destructive">
                      {toMsg}
                    </p>
                  ) : (
                    <p className="text-2xs text-muted-foreground">
                      Leave blank for indefinite / ongoing subscriptions.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {error ? (
              <p role="alert" className="text-2xs text-destructive">
                {error}
              </p>
            ) : null}

            <Button type="submit" disabled={pending || !valid} className="self-start">
              {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
              Save project value
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Project values</CardTitle>
          <CardDescription>Apps with a contract value or subscription on file.</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No project values on file"
              description="Margin cannot be stated without one — use the form above."
              className="rounded-xl border border-dashed border-border"
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Project</TableHead>
                    <TableHead scope="col" className="text-right">
                      Contract value
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Subscription
                    </TableHead>
                    <TableHead scope="col">Set by</TableHead>
                    <TableHead scope="col" className="w-0" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.appId}>
                      <TableCell className="max-w-48 break-words font-medium">
                        {row.appName}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {row.contractValue ? formatMoney(row.contractValue, row.currency) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {row.subscriptionMonthly ? (
                          <span className="flex flex-col items-end gap-0.5">
                            <span>{formatMoney(row.subscriptionMonthly, row.currency)}/mo</span>
                            {headcounts[row.appId] ? (
                              <span className="text-2xs text-muted-foreground font-sans">
                                ({headcounts[row.appId]} {headcounts[row.appId] === 1 ? 'member' : 'members'})
                              </span>
                            ) : null}
                            {row.subscriptionFrom ? (
                              <span className="text-2xs text-muted-foreground">
                                from {row.subscriptionFrom}
                                {row.subscriptionTo ? ` to ${row.subscriptionTo}` : ' (ongoing)'}
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.setByName ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => selectApp(row.appId)}>
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
