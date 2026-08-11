'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { JobRoleSelect } from '@/components/shared/job-role-select'
import { createUser } from '@/features/admin/actions'
import { OrgTagsField } from '@/features/admin/components/org-tags-field'

type FormState = {
  email: string
  name: string
  role: 'admin' | 'member'
  title: string
  orgTags: string[]
}

const emptyState: FormState = {
  email: '',
  name: '',
  role: 'member',
  title: '',
  orgTags: [],
}

// Admin-only "add a teammate" dialog. The new account gets the shared starter
// password and is forced to replace it on first sign-in (see src/proxy.ts).
export function AddUserDialog({ existingOrgTags }: { existingOrgTags: string[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState<FormState>(emptyState)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    setForm(emptyState)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const res = await createUser({
        email: form.email,
        name: form.name,
        role: form.role,
        title: form.title.trim() || undefined,
        orgTags: form.orgTags,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(
        `User added — starter password: ${res.data.starterPassword} (share it once; they must change it on first sign-in)`,
        { duration: 15000 },
      )
      handleOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" />}>Add user</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
          <DialogDescription>
            They sign in with this email and the starter password, then set their
            own before doing anything else.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-user-email">Email</Label>
            <Input
              id="new-user-email"
              type="email"
              autoComplete="off"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
              className="h-9"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-user-name">Name</Label>
            <Input
              id="new-user-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              minLength={1}
              maxLength={80}
              required
              className="h-9"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-user-role">Role</Label>
            <Select
              value={form.role}
              onValueChange={(value) =>
                setForm((f) => ({ ...f, role: value as 'admin' | 'member' }))
              }
            >
              <SelectTrigger id="new-user-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-user-job-role">Job role</Label>
            <JobRoleSelect
              id="new-user-job-role"
              ariaLabel="Job role"
              value={form.title}
              onChange={(title) => setForm((f) => ({ ...f, title }))}
              disabled={isPending}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-user-org-tags">Organizations</Label>
            <OrgTagsField
              inputId="new-user-org-tags"
              tags={form.orgTags}
              onTagsChange={(orgTags) => setForm((f) => ({ ...f, orgTags }))}
              suggestions={existingOrgTags}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Adding…' : 'Add user'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
