import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { Sidebar } from '@/components/shell/sidebar'
import { Header } from '@/components/shell/header'
import { AccountMenu } from '@/components/shell/account-menu'
import { CommandCenterProvider } from '@/features/search/components/command-center'
import { AiMeterProvider } from '@/features/gemini/components/ai-meter-provider'
import { MotionProvider } from '@/components/motion/motion-provider'
import { RouteTransition } from '@/components/motion/route-transition'
import { AskBubble } from '@/features/intel/components/ask-bubble'
import { askAvailable } from '@/features/intel/actions'
import { getOwnTitle } from '@/features/auth/queries'
import { effectiveGrant, isAdminRole } from '@/features/auth/capabilities'
import { loadActor } from '@/features/auth/actor'
import { visibleSections } from '@/features/admin/sections'
import { countPendingApprovals } from '@/features/admin/approval-queries'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  // Defense in depth: the proxy guard is the primary gate, but its matcher
  // necessarily excludes static-asset paths, so no authed page should rely on
  // it alone.
  if (!session?.user) redirect('/sign-in')
  // Before getOwnTitle, before the shell, before any child page's queries
  // run: a deactivated account must not read a row it happens to still be
  // permitted to read. The proxy gate is the primary one (src/proxy.ts) —
  // this is the same defense-in-depth the sign-in check above exists for,
  // and it is what makes "sees nothing" true rather than merely likely.
  if (!session.user.active) redirect('/deactivated')
  const isAdmin = isAdminRole(session.user.role)
  // Whether to offer the /progress row at all — asked with the SAME
  // expression the page itself redirects on, so the nav and the page cannot
  // disagree. `undefined` for the employment type is not a shortcut: no
  // stage caps 'worklog.view' (it is in neither APPROVAL_ACTIONS nor
  // IRREVERSIBLE_ACTIONS, so isCappable is false for it), which means the
  // seat's row IS the effective answer and the layout can skip loading the
  // actor — a DB read on every authed page for a row that would not move.
  const progressGrant = effectiveGrant(session.user.role, undefined, 'worklog.view')
  const canSeeProgress = progressGrant === 'all' || progressGrant === 'scoped'
  // Job role (users.title) isn't on the session/JWT (setUserTitle in
  // features/admin/actions.ts never re-mints the token) — read it here,
  // right alongside the session this layout already fetches, and thread it
  // into Header as a prop rather than adding a client-side fetch there.
  //
  // askAvailable() owns routed-ness, the feature pref and key presence
  // together, so nothing can advertise on every page something the action
  // would then refuse. It no longer decides WHETHER the bubble mounts, only
  // which of its two halves it opens on — see the note at the mount below.
  // Resolved here rather than in the component because the layout is already
  // async — a client-side probe would flash a trigger and then remove it.
  //
  // Both reads in one Promise.all: they are independent, and every authed page
  // waits on this layout, so sequencing them would add a round trip to every
  // navigation in the app.
  /*
   * WHETHER THIS SEAT COULD APPROVE ANYTHING, asked from the role alone before
   * any row is read.
   *
   * The Manage list and the approvals badge both need a real Actor, and
   * loadActor() is a database read — the very read the note above deliberately
   * avoids doing on every authed page. This keeps that promise for the seats it
   * was made for: a member or an editor answers 'none' here and the actor is
   * never loaded, so they pay nothing for a nav section they cannot see.
   *
   * `undefined` for the employment type makes this an UPPER BOUND rather than
   * the final answer, and that is the safe direction: an employment stage can
   * only narrow a grant, never widen one, so 'none' here is genuinely none. Any
   * other answer means "ask properly", which is what loadActor + can() then do.
   */
  const mayReview = effectiveGrant(session.user.role, undefined, 'request.review') !== 'none'

  const [title, canAsk, actor] = await Promise.all([
    getOwnTitle(session.user.id),
    askAvailable(),
    isAdmin || mayReview ? loadActor() : Promise.resolve(null),
  ])

  // Both of these are no-ops for a null actor, so the common seat does no
  // further work: countPendingApprovals returns NO_APPROVALS without a query,
  // and there are no sections to list.
  const approvals = await countPendingApprovals(actor)
  // Resolved HERE because the filter is a capability check and the sidebar is a
  // client component. It gets the answer, never the question.
  const adminSections = actor
    ? visibleSections(actor).map(({ href, label, danger }) => ({ href, label, danger }))
    : []
  const user = { name: session.user.name, image: session.user.image, title }

  return (
    /* The whole session user, not `isAdmin`: palette rows carry their own
       visibility rule (features/search/registry/types.ts), and a rule like
       "admin or the person themselves" cannot be recovered once the session
       has been flattened to one boolean on the way in. */
    <CommandCenterProvider user={session.user}>
      {/* The animation runtime, mounted once for the authed shell rather than
          per route — see the note in motion-provider.tsx on why this is
          LazyMotion and not the plain `motion` import. Deliberately NOT in
          app/layout.tsx: the sign-in screen and the public pages animate with
          CSS only, and they should not pay for a library to do it. */}
      <MotionProvider>
        {/* Wraps the whole authed shell because every AI trigger in the app
            sits inside it, and a meter that covered only some of them would
            leave the corner empty during the calls nobody wrapped — which
            reads as "nothing is running". Renders no chrome until a task
            starts. */}
        <AiMeterProvider>
          <div className="flex min-h-full flex-1">
            {/* AccountMenu is a server component (its sign-out is an inline server
                action), so it is rendered here and threaded into the client
                Sidebar as a slot rather than imported by it. */}
            <Sidebar
              isAdmin={isAdmin}
              canSeeProgress={canSeeProgress}
              adminSections={adminSections}
              approvals={approvals}
              account={<AccountMenu user={user} role={session.user.role} variant="sidebar" />}
              /* The same menu in its avatar-only form, for when the sidebar is
                 collapsed to an icon rail. Both are built here because
                 AccountMenu is a server component and the client Sidebar can
                 only pick between variants it is handed — it mounts exactly
                 one. Not optional chrome: the header's copy is `md:hidden`, so
                 on desktop this is the only way to reach sign-out. */
              accountCompact={<AccountMenu user={user} role={session.user.role} variant="compact" />}
            />
            {/* `min-w-0` is load-bearing, not tidying. A flex item's default
                `min-width: auto` resolves to its CONTENT's intrinsic minimum,
                so this column refuses to shrink below the widest thing any
                page puts in it. The sidebar beside it is `shrink-0`, so that
                overflow has nowhere to go: one wide child — a table, the
                meetings time grid, a long unbroken URL, a Sinhala run with no
                break opportunity — widens this column past the viewport and
                THE WHOLE PAGE scrolls sideways, sidebar and header included.
                With `min-w-0` the column may shrink to the viewport and the
                wide child scrolls inside its own `overflow-x-auto` container,
                which is what every table wrapper in the app already assumes
                (see components/ui/table.tsx, which wraps every table in one).
                Set on both this column and <main>: either one left at `auto`
                re-establishes the floor for everything inside it. */}
            <div className="flex min-w-0 flex-1 flex-col">
              <Header
                user={user}
                role={session.user.role}
                isAdmin={isAdmin}
                canSeeProgress={canSeeProgress}
              />
              {/* Inside <main>, so the arrival wraps the page and not the
                  shell — the sidebar and header stay put across navigations,
                  which is what makes them read as the frame rather than part of
                  the page. */}
              <main className="flex min-w-0 flex-1 flex-col">
                <RouteTransition>{children}</RouteTransition>
              </main>
              {/* Mounted once, outside <main>, so it floats over every page
                  without entering any page's document flow or heading outline.

                  ALWAYS MOUNTED since /intel was removed. It used to be gated on
                  canAsk, on the rule that a bubble which then refuses to answer
                  is worse than none. But it is now the only way to reach the
                  signals, and signals are computed WITHOUT a model precisely so
                  that a reader with AI off still learns what needs them — gating
                  it here would have hidden that list from exactly those readers.
                  canAsk is passed in instead, and the bubble decides what it is. */}
              <AskBubble canAsk={canAsk} />
            </div>
          </div>
        </AiMeterProvider>
      </MotionProvider>
    </CommandCenterProvider>
  )
}
