'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { toast } from 'sonner'
import { GitBranch } from 'lucide-react'
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
import { setOwnGithubLogin } from '@/features/auth/actions'

/**
 * Self-serve GitHub username — what lets "Fill from my day" count your
 * commits as evidence. Mirror of PhoneField: same card, same self-only
 * action shape, same blank-to-remove contract.
 */
export function GithubLoginField({ githubLogin }: { githubLogin: string | null }) {
  const [value, setValue] = useState(githubLogin ?? '')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      try {
        const res = await setOwnGithubLogin(value)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(value.trim() ? 'GitHub username saved' : 'GitHub username removed')
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2" className="flex items-center gap-2 font-heading">
          <GitBranch className="size-4" aria-hidden /> GitHub
        </CardTitle>
        <CardDescription>
          Lets the worklog’s “Fill from my day” count your commits as evidence, once the
          workspace’s GitHub App is connected. Your username, not a login — leave it blank
          to disconnect.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="own-github-login">GitHub username</Label>
            <Input
              id="own-github-login"
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="octocat"
              maxLength={80}
              className="h-9 max-w-xs font-mono"
            />
          </div>
          <Button type="submit" size="sm" className="self-start" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save username'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
