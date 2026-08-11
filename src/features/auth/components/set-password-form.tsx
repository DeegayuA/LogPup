'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { setOwnPassword } from '@/features/auth/actions'
import type { ActionResult } from '@/lib/action-result'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="self-start">
      {pending ? 'Saving…' : 'Set password'}
    </Button>
  )
}

// Lets any signed-in user (however they signed in — Google, Notion, dev login) add
// email + password as a login method for their own account. This is the only UI path
// that can set a passwordHash; there is no public registration form.
export function SetPasswordForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction] = useActionState<ActionResult | null, FormData>(setOwnPassword, null)

  useEffect(() => {
    if (!state) return
    if (state.ok) {
      toast.success('Password set — you can now sign in with email + password')
      formRef.current?.reset()
    } else {
      toast.error(state.error)
    }
  }, [state])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>
          Set a password to sign in with your email, alongside Google sign-in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-new-password">New password</Label>
            <Input
              id="profile-new-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              className="h-9 max-w-xs"
            />
            <p className="text-xs text-muted-foreground">At least 10 characters.</p>
          </div>
          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  )
}
