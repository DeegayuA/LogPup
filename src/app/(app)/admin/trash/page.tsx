import { notFound } from 'next/navigation'
import { TrashCard } from '@/features/admin/components/trash-card'
import { getTrash } from '@/features/admin/trash-queries'
import { loadActor } from '@/features/auth/actor'
import { can } from '@/features/auth/capabilities'

export default async function AdminTrashPage() {
  const actor = await loadActor()
  if (!actor || !can(actor, 'trash.view')) notFound()
  return <TrashCard groups={await getTrash()} />
}
