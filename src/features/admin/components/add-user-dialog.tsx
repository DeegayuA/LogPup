'use client'

import { useMemo, useState, useTransition, type FormEvent } from 'react'
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
import { badgeVariants } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ALL_ROLES, ROLE_GROUPS } from '@/lib/roles'
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

  // Curated job titles (src/lib/roles.ts) offered as one-click suggestions,
  // filtered as the admin types. Free text stays allowed — these are hints,
  // not an enum. Hidden once the input exactly matches a suggestion.
  const titleSuggestions = useMemo(() => {
    const q = form.title.trim().toLowerCase()
    if (ALL_ROLES.some((r) => r.toLowerCase() === q)) return []
    return ROLE_GROUPS.map((group) => ({
      label: group.label,
      roles: group.roles.filter((r) => r.toLowerCase().includes(q)),
    })).filter((group) => group.roles.length > 0)
  }, [form.title])

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
            <Label htmlFor="new-user-title">Title</Label>
            <Input
              id="new-user-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              maxLength={80}
              placeholder="e.g. Frontend Developer"
              className="h-9"
            />
            {titleSuggestions.length > 0 ? (
              <div className="flex max-h-24 flex-col gap-1.5 overflow-y-auto">
                {titleSuggestions.map((group) => (
                  <div key={group.label} className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">{group.label}</span>
                    <div className="flex flex-wrap gap-1">
                      {group.roles.map((role) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, title: role }))}
                          className={cn(
                            badgeVariants({ variant: 'outline' }),
                            'cursor-pointer outline-none transition-colors hover:bg-muted hover:text-foreground',
                          )}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
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
