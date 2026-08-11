'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Briefcase } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { JobRoleSelect } from '@/components/shared/job-role-select'
import { setOwnTitle } from '@/features/auth/actions'

/**
 * Self-serve job role/title (users.title) — distinct from the admin/member
 * permission role shown as a badge elsewhere on this page. Commits on every
 * pick (JobRoleSelect calls back immediately), so there's no separate save
 * step; a rejected write reverts the optimistic selection.
 */
export function JobRoleField({ title }: { title: string | null }) {
  const router = useRouter()
  const [value, setValue] = useState(title ?? '')
  const [isPending, startTransition] = useTransition()

  function handleChange(next: string) {
    const previous = value
    setValue(next)
    startTransition(async () => {
      try {
        const res = await setOwnTitle(next)
        if (!res.ok) {
          toast.error(res.error)
          setValue(previous)
          return
        }
        toast.success(next ? 'Job role saved' : 'Job role cleared')
        router.refresh()
      } catch {
        toast.error('Something went wrong — try again')
        setValue(previous)
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading">
          <Briefcase className="size-4" aria-hidden /> Job role
        </CardTitle>
        <CardDescription>
          {value
            ? 'Shown to teammates on People and in your account menu.'
            : 'No job role set — pick one below so teammates know what you do.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <JobRoleSelect
          id="own-job-role"
          value={value}
          onChange={handleChange}
          disabled={isPending}
          ariaLabel="Job role"
        />
      </CardContent>
    </Card>
  )
}
