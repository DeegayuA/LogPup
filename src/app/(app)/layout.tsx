import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { Sidebar } from '@/components/shell/sidebar'
import { Header } from '@/components/shell/header'
import { AccountMenu } from '@/components/shell/account-menu'
import { CommandCenterProvider } from '@/features/search/components/command-center'
import { AiMeterProvider } from '@/features/gemini/components/ai-meter-provider'
import { AskBubble } from '@/features/intel/components/ask-bubble'
import { askAvailable } from '@/features/intel/actions'
import { getOwnTitle } from '@/features/auth/queries'
import { effectiveGrant, isAdminRole } from '@/features/auth/capabilities'

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
  const [title, canAsk] = await Promise.all([getOwnTitle(session.user.id), askAvailable()])
  const user = { name: session.user.name, image: session.user.image, title }

  return (
    /* The whole session user, not `isAdmin`: palette rows carry their own
       visibility rule (features/search/registry/types.ts), and a rule like
       "admin or the person themselves" cannot be recovered once the session
       has been flattened to one boolean on the way in. */
    <CommandCenterProvider user={session.user}>
      {/* Wraps the whole authed shell because every AI trigger in the app sits
          inside it, and a meter that covered only some of them would leave the
          corner empty during the calls nobody wrapped — which reads as
          "nothing is running". Renders no chrome until a task starts. */}
      <AiMeterProvider>
        <div className="flex min-h-full flex-1">
          {/* AccountMenu is a server component (its sign-out is an inline server
              action), so it is rendered here and threaded into the client
              Sidebar as a slot rather than imported by it. */}
          <Sidebar
            isAdmin={isAdmin}
            canSeeProgress={canSeeProgress}
            account={<AccountMenu user={user} role={session.user.role} variant="sidebar" />}
          />
          <div className="flex flex-1 flex-col">
            <Header
              user={user}
              role={session.user.role}
              isAdmin={isAdmin}
              canSeeProgress={canSeeProgress}
            />
            <main className="flex flex-1 flex-col">{children}</main>
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
    </CommandCenterProvider>
  )
}
