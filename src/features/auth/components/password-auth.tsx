'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { loginWithPassword } from '@/features/auth/actions'
import type { ActionResult } from '@/lib/action-result'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="secondary" size="lg" className="w-full" disabled={pending}>
      {pending ? 'Please wait…' : 'Sign in with password'}
    </Button>
  )
}

// Email + password LOGIN only. There is no self-registration here — a password only
// works once it's been set via the "Set password" card on the dashboard (see
// src/features/auth/components/set-password-form.tsx), which requires an existing
// authenticated session.
export function PasswordAuth() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(loginWithPassword, null)
  const error = state && !state.ok ? state.error : null

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required className="h-9" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-9"
        />
      </div>
      {error && (
        <div role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <SubmitButton />
    </form>
  )
}
