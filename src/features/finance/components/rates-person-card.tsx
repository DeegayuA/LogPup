'use client'

/**
 * Person rate overrides — SALARY DATA. Deliberately calm, per the design's
 * "watchdog calm" rule and schema.ts's "no cost-per-person chart, ever":
 * rows are alphabetical by name ONLY (the order `listActiveUsers` already
 * returns them in). Never add a sort-by-amount control, a total, a count of
 * who earns what, or a comparison — a sortable amount column IS the
 * forbidden cost-per-person chart, with extra steps.
 */
import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2Icon, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchSelect } from '@/components/ui/search-select'
import { CurrencySelect } from '@/components/shared/currency-select'
import { RatesIntervalTable } from '@/features/finance/components/rates-interval-table'
import { closePersonRate, setPersonRate } from '@/features/finance/rate-actions'
import type { PersonRateRow } from '@/features/finance/rate-intervals'
import type { ActiveUser } from '@/features/people/queries'

export function RatesPersonCard({
  people,
  rows,
  today,
}: {
  people: ActiveUser[]
  rows: PersonRateRow[]
  today: string
}) {
  const router = useRouter()
  const fieldId = useId()

  const [userId, setUserId] = useState('')
  const [hourly, setHourly] = useState('')
  const [currency, setCurrency] = useState('LKR')
  const [effectiveFrom, setEffectiveFrom] = useState(today)
  const [error, setError] = useState<string | null>(null)
  const [pending, startPending] = useTransition()

  const [closingId, setClosingId] = useState<string | null>(null)
  const [closing, startClosing] = useTransition()

  const hourlyValue = Number(hourly)
  const valid =
    userId.length > 0 &&
    hourly.trim().length > 0 &&
    Number.isFinite(hourlyValue) &&
    hourlyValue >= 0 &&
    /^[A-Za-z]{3}$/.test(currency.trim()) &&
    effectiveFrom.length > 0

  const options = people.map((person) => ({ value: person.id, label: person.name }))
  const selectedName = people.find((person) => person.id === userId)?.name

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!valid) return
    setError(null)
    startPending(async () => {
      const res = await setPersonRate({
        userId,
        hourly: hourlyValue,
        currency: currency.trim().toUpperCase(),
        effectiveFrom,
      })
      if (!res.ok) {
        setError(
          res.error.includes('close it first')
            ? `${res.error}, using the Close button in the table below.`
            : res.error,
        )
        return
      }
      toast.success(`Rate set for ${selectedName ?? 'that person'}`)
      setUserId('')
      setHourly('')
      setEffectiveFrom(today)
      router.refresh()
    })
  }

  function handleClose(row: PersonRateRow) {
    setClosingId(row.id)
    startClosing(async () => {
      const res = await closePersonRate({ userId: row.userId, effectiveTo: today })
      if (!res.ok) {
        toast.error(res.error)
        setClosingId(null)
        return
      }
      toast.success(`Rate override for ${row.personName} closed`)
      setClosingId(null)
      router.refresh()
    })
  }

  const dateHelpId = `${fieldId}-date-help`

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle as="h2">Set a person override</CardTitle>
          <CardDescription>
            Overrides a person&apos;s job-role rate. Everyone without one is priced by their
            role&apos;s rate, which is the normal case.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5 sm:col-span-1">
                <Label htmlFor={`${fieldId}-person`}>Person</Label>
                <SearchSelect
                  id={`${fieldId}-person`}
                  value={userId}
                  onValueChange={(next) => {
                    setUserId(next)
                    setError(null)
                  }}
                  options={options}
                  placeholder="Select a person…"
                  searchPlaceholder="Type a name…"
                  disabled={pending}
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
              <p role="alert" className="text-2xs text-destructive">
                {error}
              </p>
            ) : null}

            <Button type="submit" disabled={pending || !valid} className="self-start">
              {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
              Set override
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Person overrides</CardTitle>
          <CardDescription>
            Alphabetical by name — never sorted by amount, totalled, or compared.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState
              icon={UserRound}
              title="No overrides"
              description="Everyone is priced by their job role's rate, which is the normal case — use the form above only for an exception."
              className="rounded-xl border border-dashed border-border"
            />
          ) : (
            <RatesIntervalTable
              rows={rows}
              today={today}
              subjectHeader="Person"
              subjectOf={(row) => row.personName}
              onClose={handleClose}
              closingId={closing ? closingId : null}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
