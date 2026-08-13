'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { startRegistration } from '@simplewebauthn/browser'
import { Fingerprint, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  beginPasskeyRegistration,
  completePasskeyRegistration,
  deletePasskey,
  listPasskeys,
  type PasskeySummary,
} from '@/features/auth/webauthn-actions'

/**
 * Settings card: the passkeys this account can sign in with.
 *
 * Registration is a two-step ceremony (challenge → platform authenticator →
 * verify), so this must be a client component; the LIST, though, arrives as
 * a prop from the server page — no fetch waterfall on open, and add/remove
 * re-pull through the same action the page used, so the two can't disagree
 * about shape.
 *
 * A default label is derived from the platform ("Mac", "Android", …) rather
 * than asked for — a naming prompt before the biometric sheet doubles the
 * ceremony for a value most people would leave blank.
 */
export function PasskeysCard({ initial }: { initial: PasskeySummary[] }) {
  const [passkeys, setPasskeys] = useState(initial)
  const [busy, setBusy] = useState(false)

  async function refresh() {
    const res = await listPasskeys()
    if (res.ok) setPasskeys(res.data)
  }

  async function addPasskey() {
    setBusy(true)
    try {
      const options = await beginPasskeyRegistration()
      if (!options.ok) {
        toast.error(options.error)
        return
      }
      let attestation
      try {
        attestation = await startRegistration(options.data)
      } catch {
        return // sheet dismissed — their call, not an error
      }
      const platform = /mac/i.test(navigator.platform)
        ? 'Mac'
        : /win/i.test(navigator.platform)
          ? 'Windows'
          : /android/i.test(navigator.userAgent)
            ? 'Android'
            : /iphone|ipad/i.test(navigator.userAgent)
              ? 'iPhone/iPad'
              : 'This device'
      const res = await completePasskeyRegistration(attestation, platform)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Passkey added — next sign-in is one tap')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function removePasskey(id: string) {
    const res = await deletePasskey(id)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Passkey removed')
    await refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fingerprint aria-hidden className="size-4" />
          Passkeys
        </CardTitle>
        <CardDescription>
          Sign in with Touch ID, Face ID or your phone — one tap, no password. Add one per
          device you use.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {passkeys.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {passkeys.map((key) => (
              <li
                key={key.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">{key.label ?? 'Passkey'}</p>
                  <p className="text-xs text-muted-foreground">
                    Added {format(new Date(key.createdAt), 'MMM d, yyyy')}
                    {key.lastUsedAt
                      ? ` · last used ${format(new Date(key.lastUsedAt), 'MMM d')}`
                      : ' · never used'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removePasskey(key.id)}
                  aria-label={`Remove passkey ${key.label ?? ''}`.trim()}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No passkeys yet — add one and the next sign-in on this device is a single tap.
          </p>
        )}
        <Button type="button" variant="outline" size="sm" onClick={addPasskey} disabled={busy}>
          {busy ? (
            <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" />
          ) : (
            <Plus aria-hidden />
          )}
          Add a passkey
        </Button>
      </CardContent>
    </Card>
  )
}
