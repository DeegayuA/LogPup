'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { setOwnPhone } from '@/features/auth/actions'

/** Self-serve contact number — what the call button on People dials. */
export function PhoneField({ phone }: { phone: string | null }) {
  const router = useRouter()
  const [value, setValue] = useState(phone ?? '')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      try {
        const res = await setOwnPhone(value)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(value.trim() ? 'Phone number saved' : 'Phone number removed')
        router.refresh()
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading">
          <Phone className="size-4" aria-hidden /> Phone
        </CardTitle>
        <CardDescription>
          Teammates get a call button next to your name on the People page. Leave it blank
          to remove it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="own-phone">Mobile number</Label>
            <Input
              id="own-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="+94 71 234 5678"
              maxLength={30}
              className="h-9 max-w-xs font-mono"
            />
          </div>
          <Button type="submit" size="sm" className="self-start" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save number'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
