import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { Sidebar } from '@/components/shell/sidebar'
import { Header } from '@/components/shell/header'
import { CommandCenterProvider } from '@/features/search/components/command-center'
import { getOwnTitle } from '@/features/auth/queries'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  // Defense in depth: the proxy guard is the primary gate, but its matcher
  // necessarily excludes static-asset paths, so no authed page should rely on
  // it alone.
  if (!session?.user) redirect('/sign-in')
  const isAdmin = session.user.role === 'admin'
  // Job role (users.title) isn't on the session/JWT (see setOwnTitle in
  // features/auth/actions.ts, which never re-mints the token) — read it here,
  // right alongside the session this layout already fetches, and thread it
  // into Header as a prop rather than adding a client-side fetch there.
  const title = await getOwnTitle(session.user.id)

  return (
    <CommandCenterProvider isAdmin={isAdmin}>
      <div className="flex min-h-full flex-1">
        <Sidebar isAdmin={isAdmin} />
        <div className="flex flex-1 flex-col">
          <Header
            user={{ name: session?.user?.name, image: session?.user?.image, title }}
            isAdmin={isAdmin}
          />
          <main className="flex flex-1 flex-col">{children}</main>
        </div>
      </div>
    </CommandCenterProvider>
  )
}
