import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { appComments, users } from '@/db/schema'

export type AppComment = {
  id: string
  body: string
  createdAt: Date
  authorId: string
  authorName: string
  authorAvatarUrl: string | null
}

export async function listAppComments(appId: string): Promise<AppComment[]> {
  return db
    .select({
      id: appComments.id,
      body: appComments.body,
      createdAt: appComments.createdAt,
      authorId: appComments.authorId,
      authorName: users.name,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(appComments)
    .innerJoin(users, eq(users.id, appComments.authorId))
    .where(eq(appComments.appId, appId))
    .orderBy(asc(appComments.createdAt))
}
