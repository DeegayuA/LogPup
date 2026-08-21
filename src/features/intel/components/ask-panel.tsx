'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, CornerDownLeft, History, Sparkles, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Skeleton } from '@/components/ui/skeleton'
import { SpotlightCard } from '@/components/ui/spotlight-card'
import { Textarea } from '@/components/ui/textarea'
import { askWorkspace, type AskAnswer } from '@/features/intel/actions'
import { splitAnswerLinks } from '@/features/intel/answer-links'
import { appendTurn, parseChat, type ChatTurn } from '@/features/intel/chat-history'
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

/** Versioned, so a shape change retires the old transcript instead of parsing it. */
const CHAT_KEY = 'logpup.intel.chat.v1'
const CHAT_EVENT = 'logpup:intel-chat'

/*
 * The transcript is read through useSyncExternalStore rather than hydrated
 * into state from an effect: localStorage IS an external system, and this is
 * React's contract for one. The server snapshot is the empty list, so SSR and
 * the hydration render agree, and no setState-in-effect cascade is needed.
 * Same-tab writes announce themselves on a custom event; 'storage' covers
 * other tabs for free.
 */
const NO_CHAT: readonly ChatTurn[] = []

/** getSnapshot must be referentially stable while the store is unchanged, or
 *  useSyncExternalStore loops — so the parsed transcript is cached against the
 *  raw string it came from. Module-level, because localStorage is global too. */
let chatCache: { raw: string; value: readonly ChatTurn[] } | null = null

function readChat(): readonly ChatTurn[] {
  let raw: string
  try {
    raw = window.localStorage.getItem(CHAT_KEY) ?? ''
  } catch {
    /* Private mode or a hardened browser: the transcript is a convenience. */
    return NO_CHAT
  }
  if (raw === '') return NO_CHAT
  if (chatCache && chatCache.raw === raw) return chatCache.value
  const value = parseChat(raw)
  chatCache = { raw, value }
  return value
}

function subscribeToChat(onStoreChange: () => void): () => void {
  window.addEventListener('storage', onStoreChange)
  window.addEventListener(CHAT_EVENT, onStoreChange)
  return () => {
    window.removeEventListener('storage', onStoreChange)
    window.removeEventListener(CHAT_EVENT, onStoreChange)
  }
}

function writeChat(turns: readonly ChatTurn[]): void {
  try {
    window.localStorage.setItem(CHAT_KEY, JSON.stringify(turns))
  } catch {
    /* Quota or a hardened browser. Not remembering the conversation is not
       worth interrupting anyone over — and appendTurn already caps the size
       precisely so this branch stays theoretical. */
    return
  }
  window.dispatchEvent(new Event(CHAT_EVENT))
}

function pushTurn(turn: ChatTurn): void {
  writeChat(appendTurn(readChat(), turn))
}

function clearChat(): void {
  try {
    window.localStorage.removeItem(CHAT_KEY)
  } catch {
    return
  }
  window.dispatchEvent(new Event(CHAT_EVENT))
}

/** Colombo-local, and SHOWN — an answer about "right now" is only readable
 *  next to the now it was asked in. */
const ASKED_AT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Colombo',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export function AskPanel({
  suggestions = [],
  initialQuestion = '',
  className,
}: {
  suggestions?: string[]
  /**
   * A question the box opens with, from `/intel?ask=…` — the command palette
   * hands a missed ⌘K search over rather than making the person retype it.
   *
   * PREFILLS AND DOES NOT SUBMIT, deliberately. Auto-asking on navigation
   * spends somebody's Gemini quota on a keystroke, and the palette is exactly
   * where a half-typed query is most likely to be the thing that arrives.
   * Seeding React state rather than syncing to the prop: this is the box's
   * opening value, not its master, and re-imposing the URL on every render
   * would fight the person editing it.
   */
  initialQuestion?: string
  className?: string
}) {
  const [question, setQuestion] = React.useState(initialQuestion)
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

  const chat = React.useSyncExternalStore(subscribeToChat, readChat, () => NO_CHAT)
  /* The turn just written, so the transcript below does not repeat the answer
     already rendered above it from state. */
  const [lastTurnId, setLastTurnId] = React.useState<string | null>(null)
  const earlier = React.useMemo(
    () => chat.filter((turn) => turn.id !== lastTurnId),
    [chat, lastTurnId],
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
      // crypto.randomUUID, not question+timestamp: asking the same thing twice
      // in one second collides, and a duplicate React key silently drops a
      // turn out of the transcript.
      const id = crypto.randomUUID()
      setLastTurnId(id)
      pushTurn({
        id,
        question: trimmed,
        answer: res.data.answer,
        citations: res.data.citations,
        grounded: res.data.grounded,
        model: res.data.model,
        askedAt: Date.now(),
      })
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

        {chat.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-3">
            <span className="flex items-center gap-1 font-mono text-2xs tracking-wide text-muted-foreground uppercase">
              <History aria-hidden className="size-3" />
              Recent
            </span>
            {chat.slice(0, 4).map((turn) => (
              <Button
                key={turn.id}
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => fill(turn.question)}
                className="max-w-[16rem] text-muted-foreground"
              >
                <span className="truncate">{turn.question}</span>
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
            <div className="border-t border-border/50 pt-4">
              <AnswerBody
                answer={answer.answer}
                citations={answer.citations}
                grounded={answer.grounded}
                model={answer.model}
              />
            </div>
          ) : null}
        </div>

        {/* EARLIER TURNS. The fresh answer above is rendered from state, not
            from storage, so a browser that refuses to write (private mode, a
            full quota) still shows the answer it was just asked for — it only
            loses the history. Excluding the turn we just pushed is what keeps
            the two from rendering the same answer twice. */}
        {earlier.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-border/50 pt-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-2xs tracking-wide text-muted-foreground uppercase">
                Earlier {earlier.length === 1 ? 'question' : 'questions'}
              </span>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => {
                  clearChat()
                  setLastTurnId(null)
                }}
                className="text-muted-foreground"
              >
                <Trash2 aria-hidden className="size-3" />
                Clear
              </Button>
            </div>

            <ul className="flex flex-col gap-4">
              {earlier.map((turn) => (
                <li key={turn.id} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="min-w-0 text-sm font-medium text-foreground">{turn.question}</p>
                    {/* An answer about "right now" is only readable next to the
                        now it was asked in — these are kept, not refreshed. */}
                    <time
                      dateTime={new Date(turn.askedAt).toISOString()}
                      className="shrink-0 font-mono text-2xs text-muted-foreground"
                    >
                      {ASKED_AT.format(turn.askedAt)}
                    </time>
                  </div>
                  <AnswerBody
                    answer={turn.answer}
                    citations={turn.citations}
                    grounded={turn.grounded}
                    model={turn.model}
                  />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </SpotlightCard>
  )
}

/**
 * One answer, rendered the same whether it just arrived or came back out of
 * the transcript — a remembered answer that looked different from a fresh one
 * would read as a different kind of thing.
 */
function AnswerBody({
  answer,
  citations,
  grounded,
  model,
}: {
  answer: string
  citations: { label: string; href: string }[]
  grounded: boolean
  model: string
}) {
  return (
    <div className="flex flex-col gap-3">
      {toParagraphs(answer).map((paragraph) => (
        <p key={paragraph} className="max-w-prose text-sm leading-relaxed text-foreground">
          {/* Routes are INLINE in the prose — "Pasindu (110 percent)
              [/people/09844444-…]" — and were rendering as bracketed hex where
              a name belongs. splitAnswerLinks resolves each one against the
              citation list and refuses anything that is not an in-app route. */}
          {splitAnswerLinks(paragraph, citations).map((segment, i) =>
            segment.kind === 'text' ? (
              <React.Fragment key={i}>{segment.text}</React.Fragment>
            ) : (
              <Link
                key={i}
                href={segment.href}
                className="rounded-sm font-medium text-primary underline decoration-primary/30 underline-offset-2 outline-none hover:decoration-primary focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {segment.label}
              </Link>
            ),
          )}
        </p>
      ))}

      {/* Keyed off `grounded`, never off citations.length — see the field's
          comment in actions.ts. An ungrounded answer still carries rows (the
          ones the pack held), and they are labelled as what was SEARCHED
          rather than what was cited, because calling them sources would put a
          provenance claim on an answer that explicitly disclaimed one. */}
      {citations.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-2xs tracking-wide text-muted-foreground uppercase">
            {grounded ? 'From' : 'Looked at'}
          </span>
          {citations.map((citation) => (
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
        {grounded
          ? `Answered by ${model} from your workspace data — check the links before acting on it.`
          : `${model} could not tie this to specific rows. Treat it as a starting point, not a finding, and check what it looked at.`}
      </p>
    </div>
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
