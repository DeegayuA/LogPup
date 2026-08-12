'use server'

import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { apps } from '@/db/schema'
import { auth } from '@/lib/auth'
import { slugify } from '@/lib/slug'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { logActivity } from '@/features/activity/log'
import { buildAppUpdate } from '@/features/apps/update-input'

const appInput = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  repoUrl: z.union([z.url(), z.literal('')]).optional(),
  techTags: z.array(z.string().min(1)).max(10).default([]),
  status: z.enum(['active', 'paused', 'archived']).default('active'),
  leadId: z.uuid().optional(),
})

async function requireAdmin() {
  const session = await auth()
  if (session?.user?.role !== 'admin') return null
  return session
}

export async function createApp(input: unknown): Promise<ActionResult<{ slug: string }>> {
  const session = await requireAdmin()
  if (!session) return err('Admins only')
  const parsed = appInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const slug = slugify(parsed.data.name)

  // `slugify` strips everything that isn't [a-z0-9], so a name made entirely
  // of emoji or CJK ("🐶🐶", "台帳") passes the 2-character minimum and comes
  // out as the EMPTY string. That app would then live at `/apps/` — which is
  // the index route, not a detail page — and `revalidatePath('/apps/')` would
  // never match the page it was meant to refresh. There is no silent recovery
  // here that isn't a guess at what the user meant, so say so.
  if (!slug) {
    return err('That name has no letters or numbers in it — LogPup needs some for the web address')
  }

  // Check the collision explicitly instead of inferring it from a failed
  // insert. The old code caught EVERY insert error and reported all of them
  // as "an app with a similar name already exists" — so a dropped connection,
  // a bad DATABASE_URL or a column constraint change all lied to the user
  // about what went wrong and sent them off renaming a perfectly good app.
  // The unique index on `slug` is still the real guard (this check races
  // against a concurrent create); the catch below just stops reporting the
  // wrong cause.
  const [existing] = await db.select({ name: apps.name }).from(apps).where(eq(apps.slug, slug))
  if (existing) {
    return err(`“${existing.name}” already uses the address /apps/${slug} — pick another name`)
  }

  try {
    const [created] = await db
      .insert(apps)
      .values({ ...parsed.data, repoUrl: parsed.data.repoUrl || null, slug })
      .returning({ id: apps.id })
    await logActivity({
      actorId: session.user.id,
      verb: 'created',
      entityType: 'app',
      entityId: created.id,
      entityLabel: parsed.data.name,
      appId: created.id,
      appName: parsed.data.name,
      pagePath: `/apps/${slug}`,
    })
  } catch (error) {
    console.error('[apps] createApp failed:', error)
    return err('Could not create the app — try again')
  }
  revalidatePath('/apps')
  return ok({ slug })
}

export async function updateApp(appId: string, input: unknown): Promise<ActionResult> {
  const session = await requireAdmin()
  if (!session) return err('Admins only')
  // Every other action in the codebase validates the id shape before it
  // reaches the DB; this one used to pass the raw string through, so a
  // malformed id surfaced as a driver-level rejection rather than an error
  // the caller could render.
  const parsedId = z.uuid().safeParse(appId)
  if (!parsedId.success) return err('Invalid app')

  const result = buildAppUpdate(input)
  if (!result.ok) return err(result.error)

  const [app] = await db
    .select({ slug: apps.slug, name: apps.name, status: apps.status })
    .from(apps)
    .where(eq(apps.id, parsedId.data))
  if (!app) return err('App not found')

  try {
    await db.update(apps).set(result.set).where(eq(apps.id, parsedId.data))
  } catch (error) {
    console.error('[apps] updateApp failed:', error)
    return err('Could not save the changes — try again')
  }
  const name = typeof result.set.name === 'string' ? result.set.name : app.name
  const newStatus = typeof result.set.status === 'string' ? result.set.status : null
  const statusChanged = newStatus !== null && newStatus !== app.status
  await logActivity({
    actorId: session.user.id,
    verb: 'updated',
    entityType: 'app',
    entityId: parsedId.data,
    entityLabel: name,
    appId: parsedId.data,
    appName: name,
    pagePath: `/apps/${app.slug}`,
    detail: statusChanged ? `status to ${newStatus}` : null,
    metadata: statusChanged ? { status: { from: app.status, to: newStatus } } : null,
  })
  revalidatePath('/apps')
  revalidatePath(`/apps/${app.slug}`)
  return ok(undefined)
}

export async function archiveApp(appId: string): Promise<ActionResult> {
  const session = await requireAdmin()
  if (!session) return err('Admins only')
  const parsedId = z.uuid().safeParse(appId)
  if (!parsedId.success) return err('Invalid app')
  try {
    // `returning` rather than a blind update: it costs nothing extra, it tells
    // us whether the id matched anything at all (a no-op update is otherwise
    // indistinguishable from success), and it hands back the slug needed to
    // revalidate the DETAIL page. `updateApp` already revalidated both paths;
    // this one only ever refreshed the index, so an app archived from /admin
    // kept rendering as Active on /apps/<slug> until that page's cache
    // happened to expire.
    const [archived] = await db
      .update(apps)
      .set({ status: 'archived' })
      .where(eq(apps.id, parsedId.data))
      .returning({ slug: apps.slug, name: apps.name })
    if (!archived) return err('App not found')
    await logActivity({
      actorId: session.user.id,
      verb: 'updated',
      entityType: 'app',
      entityId: parsedId.data,
      entityLabel: archived.name,
      appId: parsedId.data,
      appName: archived.name,
      pagePath: `/apps/${archived.slug}`,
      detail: 'status to archived',
      metadata: { status: { to: 'archived' } },
    })
    revalidatePath('/apps')
    revalidatePath(`/apps/${archived.slug}`)
  } catch (error) {
    console.error('[apps] archiveApp failed:', error)
    return err('Could not archive the app — try again')
  }
  return ok(undefined)
}
