import { auth } from '@/lib/auth'
import { Sidebar } from '@/components/shell/sidebar'
import { Header } from '@/components/shell/header'
import { CommandCenterProvider } from '@/features/search/components/command-center'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  const isAdmin = session?.user?.role === 'admin'

  return (
    <CommandCenterProvider isAdmin={isAdmin}>
      <div className="flex min-h-full flex-1">
        <Sidebar isAdmin={isAdmin} />
        <div className="flex flex-1 flex-col">
          <Header
            user={{ name: session?.user?.name, image: session?.user?.image }}
            isAdmin={isAdmin}
          />
          <main className="flex flex-1 flex-col">{children}</main>
        </div>
      </div>
    </CommandCenterProvider>
  )
}
