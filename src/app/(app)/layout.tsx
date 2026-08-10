import { auth } from '@/lib/auth'
import { Sidebar } from '@/components/shell/sidebar'
import { Header } from '@/components/shell/header'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  return (
    <div className="flex min-h-full flex-1">
      <Sidebar isAdmin={session?.user?.role === 'admin'} />
      <div className="flex flex-1 flex-col">
        <Header user={{ name: session?.user?.name, image: session?.user?.image }} />
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </div>
  )
}
