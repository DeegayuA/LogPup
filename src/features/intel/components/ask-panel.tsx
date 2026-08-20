'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, CornerDownLeft, History, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Skeleton } from '@/components/ui/skeleton'
import { SpotlightCard } from '@/components/ui/spotlight-card'
import { Textarea } from '@/components/ui/textarea'
import { askWorkspace, type AskAnswer } from '@/features/intel/actions'
import { cn } from '@/lib/utils'

/**
 * Ask LogPup — a question box over the same grounding pack the signals are
 * ranked from.
 *
 * Errors render inside the panel, never as a toast. The reader's eyes are on
 * the answer area waiting for text to appear; a message that fades out of the
 * corner is a message they will miss, and re-asking to see it again costs a
 * second Gemini call.
 */

/** Versioned, so a shape change retires the old list instead of parsing it. */
const RECENTS_KEY = 'logpup.intel.recentQuestions.v1'
const RECENTS_MAX = 5
const RECENTS_EVENT = 'logpup:intel-recents'

/*
 * Recents are read through useSyncExternalStore rather than hydrated into
 * state from an effect: localStorage IS an external system, and this is
 * React's contract for one. The server snapshot is the empty list, so SSR and
 * the hydration render agree, and no setState-in-effect cascade is needed.
 * Same-tab writes announce themselves on a custom event; 'storage' covers
 * other tabs for free.
 */
const NO_RECENTS: readonly string[] = []

/** getSnapshot must be referentially stable while the store is unchanged, or
 *  useSyncExternalStore loops — so the parsed list is cached against the raw
 *  string it came from. Module-level, because localStorage is global too. */
let recentsCache: { raw: string; value: readonly string[] } | null = null

function readRecents(): readonly string[] {
  let raw: string
  try {
    raw = window.localStorage.getItem(RECENTS_KEY) ?? ''
  } catch {
    /* Private mode or a hardened browser: recents are a convenience. */
    return NO_RECENTS
  }
  if (raw === '') return NO_RECENTS
  if (recentsCache && recentsCache.raw === raw) return recentsCache.value
  let value: readonly string[] = NO_RECENTS
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      value = parsed.filter((item): item is string => typeof item === 'string').slice(0, RECENTS_MAX)
    }
  } catch {
    /* Corrupt entry — treat it as no history rather than crashing the panel. */
  }
  recentsCache = { raw, value }
  return value
}

function subscribeToRecents(onStoreChange: () => void): () => void {
  window.addEventListener('storage', onStoreChange)
  window.addEventListener(RECENTS_EVENT, onStoreChange)
  return () => {
    window.removeEventListener('storage', onStoreChange)
    window.removeEventListener(RECENTS_EVENT, onStoreChange)
  }
}

function pushRecent(question: string) {
  const next = [question, ...readRecents().filter((item) => item !== question)].slice(
    0,
    RECENTS_MAX,
  )
  try {
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
  } catch {
    /* Not remembering a question is not worth interrupting anyone over. */
    return
  }
  window.dispatchEvent(new Event(RECENTS_EVENT))
}

export function AskPanel({
  suggestions = [],
  className,
}: {
  suggestions?: string[]
  className?: string
}) {
  const [question, setQuestion] = React.useState('')
  const [pending, setPending] = React.useState(false)
  const [answer, setAnswer] = React.useState<AskAnswer | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  /* Set once per arriving answer and cleared the moment a new ask starts, so
     the live region announces "answer ready" exactly once and never re-reads
     the answer body — which is what putting the prose itself in a live region
     would do on every re-render. */
  const [announcement, setAnnouncement] = React.useState('')
  const boxRef = React.useRef<HTMLTextAreaElement>(null)
  /* Asking disables the textarea, the submit button and (by unmounting the
     error block) the Try again button — and the browser drops focus from a
     disabled or removed element onto <body>. Left there, the reader's next Tab
     restarts at the top of the document, past the sidebar and header, and a
     screen-reader user loses their place mid-request. So: remember that focus
     was somewhere real when the ask started, and put it back in the box if the
     ask is what took it away. */
  const hadFocus = React.useRef(false)

  const recents = React.useSyncExternalStore(
    subscribeToRecents,
    readRecents,
    () => NO_RECENTS,
  )

  React.useEffect(() => {
    if (pending || !hadFocus.current) return
    hadFocus.current = false
    /* Only when focus actually landed on <body>. Someone who clicked into the
       sidebar while waiting keeps the focus they chose — yanking it back would
       be the same theft in the other direction. */
    if (document.activeElement === document.body) boxRef.current?.focus()
  }, [pending])

  async function submit(raw: string) {
    const trimmed = raw.trim()
    if (trimmed === '' || pending) return
    hadFocus.current =
      document.activeElement !== null && document.activeElement !== document.body
    setPending(true)
    setError(null)
    setAnswer(null)
    setAnnouncement('')
    try {
      const res = await askWorkspace(trimmed)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setAnswer(res.data)
      setAnnouncement('Answer ready.')
      pushRecent(trimmed)
    } catch {
      setError('Could not reach LogPup — try asking again')
    } finally {
      setPending(false)
    }
  }

  function fill(text: string) {
    setQuestion(text)
    boxRef.current?.focus()
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    /* Enter writes a newline — a question about a sprint often wants two
       lines. Cmd/Ctrl+Enter is the send, the same contract as every other
       composer people use all day. */
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      void submit(question)
    }
  }

  return (
    <SpotlightCard
      className={cn(
        'rounded-2xl border border-border/70 bg-card/60 shadow-xs backdrop-blur-sm',
        className,
      )}
    >
      <div className="relative flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-center gap-1.5 font-mono text-2xs font-semibold tracking-[0.18em] text-primary uppercase">
          <Sparkles aria-hidden className="size-3.5" />
          Ask LogPup
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            void submit(question)
          }}
          className="flex flex-col gap-3"
        >
          <label htmlFor="intel-ask" className="sr-only">
            Ask a question about your workspace
          </label>
          <Textarea
            id="intel-ask"
            ref={boxRef}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={pending}
            rows={2}
            /* field-sizing-content on the kit Textarea is the auto-grow; the
               max stops one pasted paragraph from pushing the answer off
               screen, and the box scrolls past it. */
            className="max-h-48 resize-none text-sm"
            placeholder="Who is over capacity, and which sprint is it hurting?"
          />

          {suggestions.length > 0 && answer === null && !pending ? (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => fill(suggestion)}
                  className="max-w-full text-muted-foreground"
                >
                  <span className="truncate">{suggestion}</span>
                </Button>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <span className="flex items-center gap-1 text-2xs text-muted-foreground">
              <Kbd>
                <CornerDownLeft aria-hidden className="size-2.5" />
              </Kbd>
              for a new line, <Kbd>⌘</Kbd>
              <Kbd>Enter</Kbd> to ask
            </span>
            <Button type="submit" size="sm" disabled={pending || question.trim() === ''}>
              {pending ? 'Asking' : 'Ask'}
              <ArrowRight aria-hidden />
            </Button>
          </div>
        </form>

        {recents.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-3">
            <span className="flex items-center gap-1 font-mono text-2xs tracking-wide text-muted-foreground uppercase">
              <History aria-hidden className="size-3" />
              Recent
            </span>
            {recents.map((recent) => (
              <Button
                key={recent}
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => fill(recent)}
                className="max-w-[16rem] text-muted-foreground"
              >
                <span className="truncate">{recent}</span>
              </Button>
            ))}
          </div>
        ) : null}

        {/* One short sentence per answer. The answer body deliberately stays
            out of the live region: announcing it here would read the whole
            thing again on every re-render. */}
        <p className="sr-only" role="status" aria-live="polite">
          {announcement}
        </p>

        <div aria-busy={pending} className="empty:hidden">
          {pending ? <AnswerPending /> : null}

          {error !== null && !pending ? (
            <div
              role="alert"
              className="flex flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-sm"
            >
              <p className="font-medium">That question did not get through</p>
              <p className="text-muted-foreground">{error}</p>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void submit(question)}
                  disabled={question.trim() === ''}
                >
                  Try again
                </Button>
              </div>
            </div>
          ) : null}

          {answer !== null && !pending ? (
            <div className="flex flex-col gap-3 border-t border-border/50 pt-4">
              {toParagraphs(answer.answer).map((paragraph) => (
                <p key={paragraph} className="max-w-prose text-sm leading-relaxed text-foreground">
                  {paragraph}
                </p>
              ))}

              {/* Keyed off `grounded`, never off citations.length — see the
                  field's comment in actions.ts. An ungrounded answer still
                  carries rows (the ones the pack held), and they are labelled
                  as what was SEARCHED rather than what was cited, because
                  calling them sources would put a provenance claim on an
                  answer that explicitly disclaimed one. */}
              {answer.citations.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-2xs tracking-wide text-muted-foreground uppercase">
                    {answer.grounded ? 'From' : 'Looked at'}
                  </span>
                  {answer.citations.map((citation) => (
                    <Link
                      key={`${citation.href}:${citation.label}`}
                      href={citation.href}
                      className="inline-flex max-w-full items-center gap-1 rounded-4xl border border-border bg-muted/60 px-2 py-0.5 text-2xs font-medium text-muted-foreground outline-none transition-[color,background-color,border-color] duration-(--dur-quick) ease-out hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 motion-reduce:transition-none"
                    >
                      <span className="truncate">{citation.label}</span>
                    </Link>
                  ))}
                </div>
              ) : null}

              <p className="text-2xs text-muted-foreground">
                {answer.grounded
                  ? `Answered by ${answer.model} from your workspace data — check the links before acting on it.`
                  : `${answer.model} could not tie this to specific rows. Treat it as a starting point, not a finding, and check what it looked at.`}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </SpotlightCard>
  )
}

/** Prose of a known shape, so the wait promises that shape rather than spin. */
function AnswerPending() {
  return (
    <div className="flex flex-col gap-2 border-t border-border/50 pt-4">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/5" />
      <div className="mt-1 flex gap-1.5">
        <Skeleton className="h-5 w-24 rounded-4xl" />
        <Skeleton className="h-5 w-20 rounded-4xl" />
      </div>
    </div>
  )
}

/** Blank-line separated, which is what the prompt asks the model for; a
 *  single-paragraph answer falls out of this as one entry. */
function toParagraphs(answer: string): string[] {
  return answer
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter((part) => part !== '')
}
