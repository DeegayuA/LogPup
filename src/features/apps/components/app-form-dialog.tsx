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
import { createApp } from '@/features/apps/actions'

type Status = 'active' | 'paused' | 'archived'

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'archived', label: 'Archived' },
]

const initialState = {
  name: '',
  description: '',
  repoUrl: '',
  techTags: '',
  status: 'active' as Status,
}

export function AppFormDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState(initialState)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setForm(initialState)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const res = await createApp({
        name: form.name,
        description: form.description || undefined,
        repoUrl: form.repoUrl || undefined,
        techTags: form.techTags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        status: form.status,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('App created')
      handleOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button />}>New app</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New app</DialogTitle>
          <DialogDescription>Add a new app for the team to track.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="app-description">Description</Label>
            <Textarea
              id="app-description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              maxLength={500}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="app-repo-url">Repo URL</Label>
            <Input
              id="app-repo-url"
              type="url"
              placeholder="https://github.com/org/repo"
              value={form.repoUrl}
              onChange={(e) => setForm((f) => ({ ...f, repoUrl: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="app-tech-tags">Tech tags</Label>
            <Input
              id="app-tech-tags"
              placeholder="next.js, postgres, drizzle"
              value={form.techTags}
              onChange={(e) => setForm((f) => ({ ...f, techTags: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
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
              {isPending ? 'Creating…' : 'Create app'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
