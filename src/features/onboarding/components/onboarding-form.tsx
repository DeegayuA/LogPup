'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { toast } from 'sonner'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { submitOnboarding } from '@/features/onboarding/actions'

// Collects the two things an admin needs to review a pending self-signup:
// phone + organization. `derivedOrg` (from src/lib/org-from-domain.ts, keyed
// off the caller's own email — see the /pending server component) makes the
// organization field read-only-ish rather than editable, since the server
// action always re-derives and prefers it anyway; a client edit there
// wouldn't stick.
export function OnboardingForm({
  initialPhone,
  derivedOrg,
}: {
  initialPhone: string | null
  derivedOrg: string | undefined
}) {
  const [isPending, startTransition] = useTransition()
  const [submitted, setSubmitted] = useState(false)
  const [phone, setPhone] = useState(initialPhone ?? '')
  const [organization, setOrganization] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      try {
        const res = await submitOnboarding({
          phone,
          organization: derivedOrg ?? organization,
        })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        setSubmitted(true)
        toast.success('Details submitted')
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-border px-4 py-8 text-center">
        <CheckCircle2 className="size-5 text-primary" aria-hidden />
        <p className="text-sm font-medium">Submitted — waiting for approval</p>
        <p className="text-xs text-muted-foreground">
          An admin can now see your request. You&apos;ll get in the moment they approve it —
          no need to do anything else here.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="onboarding-phone">Phone number</Label>
        <Input
          id="onboarding-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="+94 71 234 5678"
          maxLength={30}
          required
          disabled={isPending}
          className="font-mono"
        />
      </div>
      {derivedOrg ? (
        // A plain read-only row, not a disabled input: the server re-derives
        // and prefers this value anyway, and a disabled control drops the one
        // value the admin most needs the user to VERIFY below AA contrast and
        // out of the tab order. Text is honest about being text.
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Company / organization</span>
          <p className="text-sm">{derivedOrg}</p>
          <p className="text-xs text-muted-foreground">Detected from your email domain.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="onboarding-org">Company / organization</Label>
          <Input
            id="onboarding-org"
            value={organization}
            onChange={(event) => setOrganization(event.target.value)}
            disabled={isPending}
            maxLength={30}
            required
            placeholder="Your company name"
          />
          <p className="text-xs text-muted-foreground">
            Not on a known company domain — type it in, an admin can adjust it later.
          </p>
        </div>
      )}
      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? 'Submitting…' : 'Submit for approval'}
      </Button>
    </form>
  )
}
