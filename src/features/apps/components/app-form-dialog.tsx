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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createApp, updateApp } from '@/features/apps/actions'

type Status = 'active' | 'paused' | 'archived'

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'archived', label: 'Archived' },
]

type FormState = {
  name: string
  description: string
  repoUrl: string
  techTags: string
  status: Status
}

const emptyState: FormState = {
  name: '',
  description: '',
  repoUrl: '',
  techTags: '',
  status: 'active',
}

export type AppFormInitialValues = {
  name: string
  description?: string | null
  repoUrl?: string | null
  techTags: string[]
  status: Status
}

function toFormState(values?: AppFormInitialValues): FormState {
  if (!values) return emptyState
  return {
    name: values.name,
    description: values.description ?? '',
    repoUrl: values.repoUrl ?? '',
    techTags: values.techTags.join(', '),
    status: values.status,
  }
}

export function AppFormDialog({
  appId,
  initialValues,
}: {
  appId?: string
  initialValues?: AppFormInitialValues
} = {}) {
  const isEdit = Boolean(appId)
  const submitLabel = isEdit ? 'Save changes' : 'Create app'
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState<FormState>(() => toFormState(initialValues))

  function handleOpenChange(next: boolean) {
    setOpen(next)
    // Resync from the latest props whenever the dialog opens: `form` is
    // otherwise a stale closure over whatever `initialValues` looked like
    // at mount time, so a save-then-reopen would show pre-edit values and
    // a second save would silently revert the first one.
    setForm(toFormState(initialValues))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const techTags = form.techTags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
      const res = isEdit
        ? await updateApp(appId as string, {
            name: form.name,
            // Edit mode must send description even when cleared to '' —
            // buildAppUpdate maps '' to null and persists it. Sending
            // `undefined` here would drop the key entirely and silently
            // keep the old description (see update-input.ts).
            description: form.description,
            repoUrl: form.repoUrl || undefined,
            techTags,
            status: form.status,
          })
        : await createApp({
            name: form.name,
            description: form.description || undefined,
            repoUrl: form.repoUrl || undefined,
            techTags,
            status: form.status,
          })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(isEdit ? 'App updated' : 'App created')
      handleOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button />}>{isEdit ? 'Edit app' : 'New app'}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit app' : 'New app'}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this app's details." : 'Add a new app for the team to track.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="app-name">Name</Label>
            <Input
              id="app-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              minLength={2}
              maxLength={80}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="app-description">Description</Label>
            <Textarea
              id="app-description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              maxLength={500}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="app-repo-url">Repo URL</Label>
            <Input
              id="app-repo-url"
              type="url"
              placeholder="https://github.com/org/repo"
              value={form.repoUrl}
              onChange={(e) => setForm((f) => ({ ...f, repoUrl: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="app-tech-tags">Tech tags</Label>
            <Input
              id="app-tech-tags"
              placeholder="next.js, postgres, drizzle"
              value={form.techTags}
              onChange={(e) => setForm((f) => ({ ...f, techTags: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">Comma-separated, shown as badges on the card.</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="app-status">Status</Label>
            <Select
              value={form.status}
              onValueChange={(value) => setForm((f) => ({ ...f, status: value as Status }))}
            >
              <SelectTrigger id="app-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
