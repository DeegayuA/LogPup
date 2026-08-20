'use client'

import * as React from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Puts the sign-in method you used last at the top, tagged and emphasised.
 *
 * The methods themselves are rendered on the SERVER and handed in as slots.
 * That is the point of the shape: Google's button submits a server action, and
 * the password panel is a native `<details>` with no JavaScript behind it, so
 * neither survives being re-created inside a client component. This decides
 * ORDER and EMPHASIS, nothing else.
 *
 * NO-JS AND FIRST-VISIT ARE THE SAME STATE. The server cannot know what is in
 * this browser's localStorage, so it renders the canonical order — Google,
 * passkey, password — with no tag. If scripting never runs, that is what
 * stays, which is also what a first-time visitor and Google's OAuth reviewer
 * see. There is no arrangement in which this hides a method: it reorders.
 *
 * WHAT IS STORED IS NOT A CREDENTIAL. One of three fixed strings, in
 * localStorage, never a cookie, never sent anywhere. It cannot influence what
 * the server accepts — a tampered value reorders some buttons. The tag reads
 * "Last used" and never an email address: this page is reachable by anyone,
 * and a shared machine must not disclose who signed in here last.
 */

export type SignInMethod = 'google' | 'passkey' | 'password'

const STORAGE_KEY = 'logpup.lastSignInMethod'
const METHODS: readonly SignInMethod[] = ['google', 'passkey', 'password']

function isMethod(value: string | null): value is SignInMethod {
  return value !== null && (METHODS as readonly string[]).includes(value)
}

/**
 * Records a method as the one to surface next time.
 *
 * Called when a method is CHOSEN, not when it succeeds — a real limitation
 * rather than an oversight. Google navigates away to a provider, so this page
 * never learns whether the round trip worked; there is no client-side moment
 * of success to hook. Recording the attempt means a failed sign-in can promote
 * the method that failed, which costs one glance at a button the person was
 * probably about to press anyway. Recording nothing would mean the feature
 * does not work for the method most people use. If it becomes a real
 * annoyance, the fix is to stamp the method on the session server-side and
 * read it back — not to guess harder here.
 */
export function rememberSignInMethod(method: SignInMethod): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, method)
  } catch {
    /* Private mode, or storage disabled. The next visit shows the canonical
       order — the same thing a first visit shows. */
  }
}

function readLastMethod(): SignInMethod | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return isMethod(stored) ? stored : null
  } catch {
    return null
  }
}

/** The chip that marks the promoted method. Never carries an identity. */
function LastUsedTag() {
  return (
    <span className="inline-flex w-fit items-center rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-2xs tracking-[0.14em] text-primary uppercase">
      Last used
    </span>
  )
}

export function SignInMethods({
  google,
  passkey,
  password,
}: {
  google: ReactNode
  passkey: ReactNode
  password: ReactNode
}) {
  /**
   * `null` until the effect runs, which is the same state as "nothing stored".
   * Both render the canonical order, so the server HTML and the first client
   * paint agree and there is no hydration mismatch — the only change is a
   * reorder on the frame after mount, for people who have a stored value.
   */
  const [lastUsed, setLastUsed] = React.useState<SignInMethod | null>(null)

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage cannot be read on the server; this is the first moment the value exists
    setLastUsed(readLastMethod())
  }, [])

  const slots: Record<SignInMethod, ReactNode> = { google, passkey, password }

  /* Promoted first, the rest in canonical order behind it. Sorting rather than
     splicing keeps "nothing stored" and "something stored" on one code path,
     so the default ordering cannot drift from the promoted one. */
  const ordered = [...METHODS].sort((a, b) => {
    if (a === lastUsed) return -1
    if (b === lastUsed) return 1
    return METHODS.indexOf(a) - METHODS.indexOf(b)
  })

  return (
    <div className="flex flex-col gap-4">
      {ordered.map((method) => {
        const promoted = method === lastUsed
        return (
          <div
            key={method}
            onClickCapture={() => rememberSignInMethod(method)}
            /* `data-promoted` is what the primary styling in globals.css hangs
               off. It sits on the wrapper rather than the button because the
               buttons are server-rendered and this component must not
               re-create them. */
            data-promoted={promoted ? '' : undefined}
            className={cn('flex flex-col gap-2', promoted && 'gap-2.5')}
          >
            {promoted ? <LastUsedTag /> : null}
            {slots[method]}
          </div>
        )
      })}
    </div>
  )
}
