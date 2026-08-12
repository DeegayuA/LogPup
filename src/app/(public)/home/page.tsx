import Link from 'next/link'
import type { Metadata } from 'next'
import {
  AppWindow,
  CalendarDays,
  Mic,
  ShieldCheck,
  SquareKanban,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'LogPup — engineering ops for Alta Vision teams',
  description:
    'LogPup tracks the apps a studio runs, who works on them, what each team ships this sprint, and what happened in every meeting.',
}

/**
 * The public front door. Google's OAuth review team opens the "Application
 * home page" URL from the consent screen before it will approve the sensitive
 * `calendar.events` scope, and it must load with no session, describe what the
 * app does, and link to the privacy policy — all three are checked. Everything
 * below the fold exists to answer "what is this app and why does it want my
 * calendar", in that order.
 */

const CAPABILITIES = [
  {
    icon: AppWindow,
    title: 'Apps',
    detail: 'One record per product a team runs — status, stack, lead, and the people on it.',
  },
  {
    icon: Users,
    title: 'People & capacity',
    detail: 'Allocation percentages per person, so overload is visible before it becomes a delay.',
  },
  {
    icon: SquareKanban,
    title: 'Sprints',
    detail: 'Kanban boards, backlog, and a roadmap for each app.',
  },
  {
    icon: CalendarDays,
    title: 'Meetings',
    detail: 'Schedule a meeting in LogPup and it creates the matching Google Calendar event.',
  },
] as const

export default function PublicHomePage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-14 px-6 py-16">
      <section className="flex flex-col gap-5">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <ShieldCheck className="size-3.5 shrink-0 text-primary" aria-hidden />
          An internal tool by Alta Vision (Pvt) Ltd
        </span>
        <h1 className="font-heading text-4xl leading-tight font-bold tracking-tight text-foreground">
          The watchdog for your team&apos;s apps, people, and sprints.
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
          LogPup is the engineering operations HQ Alta Vision runs its studio on. It keeps
          one shared picture of every product in flight: who is building it, how loaded they
          are, what ships this sprint, and what was decided in the last meeting.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            Access is granted by an Alta Vision administrator. New accounts land in a pending
            queue until approved.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-xl font-bold tracking-tight text-foreground">
          What LogPup does
        </h2>
        <ul className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {CAPABILITIES.map(({ icon: Icon, title, detail }) => (
            <li key={title} className="flex items-start gap-3">
              <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-foreground">{title}</span>
                <span className="text-sm leading-relaxed text-muted-foreground">{detail}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Stated plainly and up front on purpose: the reviewer is looking for
          the connection between the scope the consent screen asks for and a
          feature a user can actually see. */}
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
        <h2 className="font-heading text-xl font-bold tracking-tight text-foreground">
          Why LogPup asks for your Google Calendar
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          When you schedule a meeting in LogPup, we create the corresponding event on your own
          Google Calendar and invite the attendees you picked, so the meeting appears where your
          team already looks. Editing or cancelling the meeting in LogPup updates the same event.
          This uses the{' '}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">
            https://www.googleapis.com/auth/calendar.events
          </code>{' '}
          scope, and we use it for nothing else. LogPup never reads calendars it did not create
          events on, never sells or transfers Google user data, and never uses it for advertising.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          You can withdraw this access at any time at{' '}
          <a
            href="https://myaccount.google.com/permissions"
            className="font-medium text-primary underline underline-offset-4"
            target="_blank"
            rel="noreferrer"
          >
            myaccount.google.com/permissions
          </a>
          . See the{' '}
          <Link href="/privacy" className="font-medium text-primary underline underline-offset-4">
            Privacy Policy
          </Link>{' '}
          for the full detail, including our Google API Services Limited Use commitment.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-xl font-bold tracking-tight text-foreground">
          Meeting Intelligence
        </h2>
        <div className="flex items-start gap-3">
          <Mic className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <p className="text-sm leading-relaxed text-muted-foreground">
            LogPup can record a meeting in the browser and turn it into structured notes in English
            and Sinhala — per-person notes, action items, deadlines, and follow-up questions that
            resurface as prep before the next meeting. Recording is always started manually by a
            participant, and whoever starts it is responsible for telling everyone in the room
            first. Transcription runs on a Google Gemini API key that each user supplies themselves.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-8">
        <h2 className="font-heading text-xl font-bold tracking-tight text-foreground">Contact</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Alta Vision (Pvt) Ltd, Sri Lanka — questions about LogPup, your data, or this site go to{' '}
          <a
            href="mailto:deeghayus@altavision.lk"
            className="font-medium text-primary underline underline-offset-4"
          >
            deeghayus@altavision.lk
          </a>
          .
        </p>
      </section>
    </div>
  )
}
