import Link from 'next/link'
import { ArrowLeft, Mail, MessageCircle, Phone, ShieldCheck } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatBusinessMonthYear } from '@/features/people/format-instant'
import { telHref, waHref } from '@/lib/phone'
import { cn } from '@/lib/utils'
import { eventDotClasses } from '@/features/meetings/event-color'
import type { PersonOverview } from '@/features/people/queries'
import { isAdminRole } from '@/features/auth/capabilities'

/**
 * Identity: who this is, what state their account is in, how to reach them,
 * and — new here — which apps they actually work on, right under the name.
 *
 * The app chips are the reason this block replaced a bare "title · email" line:
 * "what is this person doing" should be answerable before you scroll, and the
 * assignment card further down is the detail, not the headline.
 *
 * ACCOUNT STATE IS SHOWN, NOT HIDDEN. Deactivated and pending people are
 * reachable here by design (getPersonOverview looks up by id alone), so the
 * badges have to say which one you are looking at — otherwise a page showing
 * 80% allocation for someone who left last month reads as current.
 *
 * Contact details are visible to every signed-in teammate, matching /people
 * and the app Team panel. Restricting them to admins is a defensible product
 * decision but a different one, and making it here alone would leave the same
 * phone number one click away on the directory.
 */
export function PersonHeader({ overview }: { overview: PersonOverview }) {
  const { user, assignments } = overview

  return (
    <header className="flex flex-col gap-4">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit text-muted-foreground"
        render={<Link href="/people" />}
      >
        <ArrowLeft aria-hidden /> People
      </Button>

      <div className="flex flex-wrap items-start gap-4">
        <Avatar size="lg" className="size-14!">
          {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
          <AvatarFallback className="text-lg font-medium">
            {user.name.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight">{user.name}</h1>
            {isAdminRole(user.role) ? (
              <Badge variant="secondary">
                <ShieldCheck aria-hidden /> Admin
              </Badge>
            ) : null}
            {!user.active ? <Badge variant="outline">Deactivated</Badge> : null}
            {user.status === 'pending' ? <Badge variant="outline">Pending approval</Badge> : null}
            {user.status === 'rejected' ? <Badge variant="destructive">Rejected</Badge> : null}
          </div>

          <p className="text-sm text-muted-foreground">
            {user.title ?? 'No title set'}
            {' · joined '}
            {/* Business timezone, like every other date on this page — see
                format-instant.ts. date-fns would have resolved this against
                the server's zone, which is UTC in production. */}
            <time dateTime={user.createdAt.toISOString()} className="font-mono">
              {formatBusinessMonthYear(user.createdAt)}
            </time>
          </p>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <a
              href={`mailto:${user.email}`}
              className="inline-flex items-center gap-1 rounded-sm underline-offset-2 transition-colors duration-150 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Mail className="size-3.5" aria-hidden />
              {user.email}
            </a>
            {/* Second address, labelled rather than run together with the
                first, so nobody mistakes it for the one they sign in with. */}
            {user.personalEmail ? (
              <a
                href={`mailto:${user.personalEmail}`}
                className="rounded-sm underline-offset-2 transition-colors duration-150 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                personal: {user.personalEmail}
              </a>
            ) : null}
            {user.orgTags.map((tag) => (
              <Badge key={tag} variant="outline" className="font-normal text-muted-foreground">
                {tag}
              </Badge>
            ))}
          </div>

          {assignments.length > 0 ? (
            <ul className="flex flex-wrap items-center gap-1.5">
              {assignments.map((entry) => (
                <li key={entry.appId}>
                  {/* #team, not the page top: the one thing a reader does
                      from this chip is act on the allocation it shows, and
                      that control lives in the app's Team panel — linking to
                      the top added a scroll-and-hunt step. */}
                  <Badge
                    variant="secondary"
                    className="font-normal"
                    render={<Link href={`/apps/${entry.slug}#team`} />}
                  >
                    {/* The app's event hue — the same dot its meetings wear
                        on the calendar and its chip wears in the directory. */}
                    <span
                      aria-hidden
                      className={cn(
                        'size-2 shrink-0 rounded-full',
                        eventDotClasses(entry.appId) ?? 'bg-muted-foreground/50',
                      )}
                    />
                    {entry.appName}
                    {/* Per-project role: the same person can be a manager on
                        one app and a reviewer on another. */}
                    {entry.role ? (
                      <span className="text-muted-foreground">· {entry.role}</span>
                    ) : null}
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {entry.allocationPct}%
                    </span>
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Not assigned to any app.</p>
          )}
        </div>

        {user.phone ? (
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" render={<a href={telHref(user.phone)} />}>
              <Phone aria-hidden />
              <span className="hidden font-mono sm:inline">{user.phone}</span>
              <span className="sr-only">
                Call {user.name} on {user.phone}
              </span>
            </Button>
            {/* Opens a blank chat — from a person's own page there is no one
                project to prefill about, and choosing wrongly is worse than
                letting them type. The prefilled variant lives on project
                surfaces (TeamPanel, Contributions), where the context is
                known. */}
            <Button variant="outline" size="sm" render={<a href={waHref(user.phone)} target="_blank" rel="noreferrer" />}>
              <MessageCircle aria-hidden />
              WhatsApp
              <span className="sr-only">Message {user.name} on WhatsApp</span>
            </Button>
          </div>
        ) : null}
      </div>

      {/* Says what the page is, because nothing else on it does: every card
          below is a read-out and no control here writes anything. Naming
          where the two editable things ARE changed keeps that from reading
          as a dead end. Named rather than written as "their", since this
          route is reachable for yourself from the directory and the
          dashboard. */}
      <p className="text-xs text-muted-foreground">
        A read-only record of {user.name}&apos;s work — allocations are set from an app&rsquo;s
        Team panel (the app chips above land there), tasks from its board.
      </p>
    </header>
  )
}
