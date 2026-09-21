'use client'

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Coins, Loader2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencySelect } from '@/components/shared/currency-select'
import { JobRoleSelect } from '@/components/shared/job-role-select'
import { RatesIntervalTable } from '@/features/finance/components/rates-interval-table'
import { closeRoleRate, setRoleRate } from '@/features/finance/rate-actions'
import type { RoleRateRow } from '@/features/finance/rate-intervals'

/**
 * Job-role rate cards. Split into a form and a table so the page can render
 * the form ahead of any Suspense boundary — it needs no server data, only
 * `JOB_ROLE_GROUPS` (a static import) — while only the table (which needs
 * `listRoleRates()`) suspends. See the spec's "Controls before data".
 */
export function RatesRoleForm({ today }: { today: string }) {
  const router = useRouter()
  const fieldId = useId()

  const [role, setRole] = useState('')
  const [hourly, setHourly] = useState('')
  const [currency, setCurrency] = useState('LKR')
  const [effectiveFrom, setEffectiveFrom] = useState(today)
  const [error, setError] = useState<string | null>(null)
  const [pending, startPending] = useTransition()

  const hourlyValue = Number(hourly)
  const valid =
    role.trim().length > 0 &&
    hourly.trim().length > 0 &&
    Number.isFinite(hourlyValue) &&
    hourlyValue >= 0 &&
    /^[A-Za-z]{3}$/.test(currency.trim()) &&
    effectiveFrom.length > 0

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!valid) return
    setError(null)
    startPending(async () => {
      const res = await setRoleRate({
        role: role.trim(),
        hourly: hourlyValue,
        currency: currency.trim().toUpperCase(),
        effectiveFrom,
      })
      if (!res.ok) {
        // The action's own overlap message already says "close it first" —
        // this points the admin at WHERE that control lives, since form and
        // table are two different components on this page.
        setError(
          res.error.includes('close it first')
            ? `${res.error}, using the Close button in the table below.`
            : res.error,
        )
        return
      }
      toast.success(`Rate set for ${role.trim()}`)
      setRole('')
      setHourly('')
      setEffectiveFrom(today)
      router.refresh()
    })
  }

  const errorId = `${fieldId}-error`
  const dateHelpId = `${fieldId}-date-help`

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Set a role rate</CardTitle>
        <CardDescription>
          What an hour costs for a job role. Every project&apos;s cost reads &quot;no rate
          set&quot; until the role doing the work has one.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5 sm:col-span-1">
              <Label htmlFor={`${fieldId}-role`}>Job role</Label>
              <JobRoleSelect
                id={`${fieldId}-role`}
                value={role}
                onChange={(next) => {
                  setRole(next)
                  setError(null)
                }}
                disabled={pending}
                ariaLabel="Job role"
                allowAllRoles
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${fieldId}-hourly`}>Hourly rate</Label>
              <Input
                id={`${fieldId}-hourly`}
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={hourly}
                onChange={(event) => {
                  setHourly(event.target.value)
                  setError(null)
                }}
                required
                className="h-9 font-mono"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${fieldId}-currency`}>Currency</Label>
              <CurrencySelect
                id={`${fieldId}-currency`}
                value={currency}
                onChange={(next) => {
                  setCurrency(next)
                  setError(null)
                }}
                disabled={pending}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${fieldId}-from`}>Effective from</Label>
            <Input
              id={`${fieldId}-from`}
              type="date"
              value={effectiveFrom}
              onChange={(event) => {
                setEffectiveFrom(event.target.value)
                setError(null)
              }}
              aria-describedby={dateHelpId}
              required
              className="h-9 w-fit font-mono"
            />
            <p id={dateHelpId} className="text-2xs text-muted-foreground">
              Hours are priced by the rate in force on the day they were logged. Backdating
              this prices history from that day — it never re-prices hours at today&apos;s
              rate.
            </p>
          </div>

          {error ? (
            <p id={errorId} role="alert" className="text-2xs text-destructive">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={pending || !valid} className="self-start">
            {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
            Set rate
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export function RatesRoleTable({ rows, today }: { rows: RoleRateRow[]; today: string }) {
  const router = useRouter()
  const [closingId, setClosingId] = useState<string | null>(null)
  const [pending, startPending] = useTransition()

  function handleClose(row: RoleRateRow) {
    setClosingId(row.id)
    startPending(async () => {
      const res = await closeRoleRate({ role: row.role, effectiveTo: today })
      if (!res.ok) {
        toast.error(res.error)
        setClosingId(null)
        return
      }
      toast.success(`Rate for ${row.role} closed`)
      setClosingId(null)
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Role rates</CardTitle>
        <CardDescription>Every role with a rate on file, and what it used to be.</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState
            icon={Coins}
            title="No rate cards yet"
            description={
              'Every project\'s cost reads "no rate set" until a role has one — use the form above.'
            }
            className="rounded-xl border border-dashed border-border"
          />
        ) : (
          <RatesIntervalTable
            rows={rows}
            today={today}
            subjectHeader="Role"
            subjectOf={(row) => (row.role === 'All roles' ? 'All roles (default)' : row.role)}
            onClose={handleClose}
            closingId={pending ? closingId : null}
          />
        )}
      </CardContent>
    </Card>
  )
}
