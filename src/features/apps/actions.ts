'use server'

import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { apps, users } from '@/db/schema'
import { auth } from '@/lib/auth'
import { managesApp } from '@/features/apps/project-manager'
import { slugify } from '@/lib/slug'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { logActivity } from '@/features/activity/log'
import { appCreateInput } from '@/features/apps/create-input'
import { buildAppUpdate, summarizeAppChanges } from '@/features/apps/update-input'
import { callGemini } from '@/features/gemini/client'
import { QUICK_MODELS } from '@/features/gemini/models'
import { fetchRepoContext, parseGitHubRepo, RepoFetchError } from '@/features/apps/repo-metadata'
import { CURATED_TECH_TAGS, canonicalizeTag } from '@/lib/tech-tags'

async function requireAdmin() {
  const session = await auth()
  if (session?.user?.role !== 'admin') return null
  return session
}

/** Same per-file helper other actions modules keep (see people/actions.ts,
 *  admin/trash-actions.ts) rather than a shared export — these files are all
 *  `'use server'`, where every export must be an async function, so a shared
 *  plain helper would need its own non-action module for one query. */
async function nameForUser(userId: string): Promise<string | null> {
  const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId))
  return user?.name ?? null
}

// Hard ceiling on the generated text. The description column is validated at
// 500 characters (appCreateInput in create-input.ts), and a model that
// overshoots would otherwise hand the admin a description that only fails on
// save — so we ask for far less than the limit and still trim to it.
const DESCRIPTION_CHAR_LIMIT = 500

/** Mirrors the `techTags` ceiling on appCreateInput in create-input.ts. */
const MAX_GENERATED_TAGS = 10

export type GeneratedApp = {
  name: string
  description: string
  techTags: string[]
}

/**
 * A private repo is not a failure — it is a request for a different input.
 * Modelled as a success outcome rather than an error so the form can open the
 * README paste box instead of showing a red message about a problem the admin
 * has no way to solve from where they are standing.
 */
export type GenerateOutcome =
  | ({ status: 'generated' } & GeneratedApp)
  | { status: 'needs-readme'; reason: string }

/** Pasted READMEs get the same ceiling as fetched ones, for the same reason. */
const README_PASTE_LIMIT = 8000

/**
 * Turns whatever we know about a repository into the three fields, via Gemini.
 *
 * Shared by both entry points below so the fetched-README and pasted-README
 * paths cannot drift into producing differently-shaped descriptions.
 */
async function generateFromFacts(
  userId: string,
  facts: string,
  fallbackName: string,
): Promise<ActionResult<GeneratedApp>> {
  const prompt = [
    'You are filling in a record for an internal engineering-operations tool that',
    'tracks the apps a software studio runs. Given the repository below, return JSON',
    'with exactly these keys: name, description, techTags.',
    '',
    'name: the product name a team would say out loud. Usually the repository name',
    '  with proper spacing and capitalisation ("logpup" -> "LogPup", "crm-api" ->',
    '  "CRM API"). Prefer a clearer title from the README heading when there is one.',
    '  2 to 80 characters.',
    '',
    'description: ONE sentence, at most 40 words, saying what the product does and',
    '  who it is for. Describe the product, not the repository — never mention README,',
    '  GitHub, stars, licences, installation, or contributing. Plain prose: no',
    '  marketing adjectives, no bullet points, no markdown, no quotes. Do not open',
    '  with the product name or "This project".',
    '',
    'techTags: the technologies this app is actually built on, as an array of at most',
    `  8 strings. Choose from this vocabulary wherever one fits: ${CURATED_TECH_TAGS.join(', ')}.`,
    '  Use a term outside it only for something genuinely used and genuinely missing.',
    '  Include only what the repository shows evidence of — no guessing from the',
    '  problem domain. Empty array if nothing is clear.',
    '',
    'If the repository does not say enough to tell what the product does, return',
    '{"name": "", "description": "", "techTags": []}.',
    '',
    facts,
  ].join('\n')

  let text: string
  try {
    // A README into one paragraph is mechanical work with an obvious right
    // answer — the cheap tier first, so the flagship stays available for the
    // meeting write-up that shares this key's quota.
    ;({ text } = await callGemini(userId, [{ text: prompt }], {
      models: QUICK_MODELS,
      responseJson: true,
    }))
  } catch (error) {
    // callGemini throws GeminiError with messages already written for users
    // ("No active Gemini API keys — add one in Profile."), so pass it through.
    const message = error instanceof Error ? error.message : 'Gemini request failed'
    return err(message)
  }

  let parsed: { name?: unknown; description?: unknown; techTags?: unknown }
  try {
    parsed = JSON.parse(text)
  } catch {
    console.error('[apps] generateFromFacts: model returned non-JSON', text.slice(0, 200))
    return err('Could not read the generated details — try again')
  }

  const description =
    typeof parsed.description === 'string'
      ? parsed.description.trim().replace(/^["']|["']$/g, '')
      : ''
  if (!description) {
    return err('That repository does not say enough to describe it — write one yourself')
  }

  // Falling back to the repo name rather than failing: a repo can be perfectly
  // identifiable ("logpup") while saying nothing about what it does, and the
  // admin can always finish the sentence themselves.
  const name =
    typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : fallbackName

  // Canonicalized against the curated vocabulary so "nextjs", "Next JS" and
  // "next.js" all land on the one tag the rest of the workspace already filters
  // by, instead of fragmenting the tag list.
  const rawTags = Array.isArray(parsed.techTags) ? parsed.techTags : []
  const techTags = [
    ...new Set(
      rawTags
        .filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
        .map((tag) => canonicalizeTag(tag.trim(), CURATED_TECH_TAGS)),
    ),
  ].slice(0, MAX_GENERATED_TAGS)

  return ok({
    name: name.slice(0, 80),
    description: description.slice(0, DESCRIPTION_CHAR_LIMIT),
    techTags,
  })
}

/**
 * Same three fields, generated from a README the admin pasted in by hand —
 * the way in for private repositories when no GITHUB_TOKEN is configured.
 *
 * The repo URL is optional context: when it parses, its owner/name give the
 * model a title to work from and supply the fallback name. When it doesn't,
 * the pasted text has to carry the whole job on its own.
 */
export async function generateAppFromReadme(
  readme: unknown,
  repoUrl?: unknown,
): Promise<ActionResult<GeneratedApp>> {
  const session = await requireAdmin()
  if (!session) return err('Admins only')

  const text = typeof readme === 'string' ? readme.trim() : ''
  if (text.length < 40) {
    return err('Paste the README contents first — a few lines is not enough to work from')
  }

  const parsedUrl = typeof repoUrl === 'string' ? parseGitHubRepo(repoUrl) : null
  const facts = [
    parsedUrl ? `Repository: ${parsedUrl.owner}/${parsedUrl.repo}` : null,
    `README:\n${text.slice(0, README_PASTE_LIMIT)}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  return generateFromFacts(session.user.id, facts, parsedUrl?.repo ?? '')
}

/**
 * Fills in an app's name, description, and tech tags from its GitHub repository.
 *
 * Returns the values rather than saving them: the admin sees them in the form,
 * edits what is wrong, and saves deliberately. AI-written fields silently
 * persisted to a shared workspace record are not something anyone asked for.
 *
 * Gemini runs on the calling admin's own key (callGemini resolves it), so this
 * costs whoever pressed the button — consistent with every other AI feature in
 * LogPup.
 */
export async function generateAppFromRepo(
  repoUrl: unknown,
): Promise<ActionResult<GenerateOutcome>> {
  const session = await requireAdmin()
  if (!session) return err('Admins only')

  const url = typeof repoUrl === 'string' ? repoUrl.trim() : ''
  if (!url) return err('Add a repository URL first')

  let context
  try {
    context = await fetchRepoContext(url)
  } catch (error) {
    if (error instanceof RepoFetchError) {
      // Unreadable-but-real repo: hand the caller the reason and let it ask for
      // a pasted README, rather than dead-ending on a message about server
      // configuration the admin cannot change from a dialog.
      if (error.recoverable) return ok({ status: 'needs-readme', reason: error.message })
      return err(error.message)
    }
    console.error('[apps] generateAppFromRepo: unexpected failure', error)
    return err('Could not read that repository')
  }

  // Everything the model gets, labelled. The README is the substance; the rest
  // is what fills the gap when a repo has no README worth reading.
  const facts = [
    `Repository: ${context.owner}/${context.repo}`,
    context.language ? `Primary language: ${context.language}` : null,
    context.topics.length ? `Topics: ${context.topics.join(', ')}` : null,
    context.description ? `GitHub description: ${context.description}` : null,
    context.readme ? `README:\n${context.readme}` : null,
  ]
    .filter(Boolean)
    .join('\n\n')

  const generated = await generateFromFacts(session.user.id, facts, context.repo)
  if (!generated.ok) return generated
  return ok({ status: 'generated', ...generated.data })
}

export async function createApp(input: unknown): Promise<ActionResult<{ slug: string }>> {
  const session = await requireAdmin()
  if (!session) return err('Admins only')
  const parsed = appCreateInput.safeParse(input)
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
    // The initial PM assignment — the other half of "keep history" alongside
    // updateApp's PM/lead-change logging below. This is an append-only audit
    // trail (activity_log), not an as-of index: it answers "who was made PM,
    // by whom, and when", not "who was PM on 12 June" from one query. See
    // summarizeAppChanges in update-input.ts for the fuller version of this
    // note.
    const pmName = await nameForUser(parsed.data.pmId)
    await logActivity({
      actorId: session.user.id,
      verb: 'created',
      entityType: 'app',
      entityId: created.id,
      entityLabel: parsed.data.name,
      appId: created.id,
      appName: parsed.data.name,
      pagePath: `/apps/${slug}`,
      detail: `with ${pmName ?? 'an unknown member'} as PM`,
      metadata: { pmId: { from: null, to: parsed.data.pmId } },
    })
  } catch (error) {
    console.error('[apps] createApp failed:', error)
    return err('Could not create the app — try again')
  }
  revalidatePath('/apps')
  return ok({ slug })
}

export async function updateApp(appId: string, input: unknown): Promise<ActionResult> {
  // Admin OR the app's project manager: the PM manages everything in their
  // project (see project-manager.ts). Editing is the widest thing they need;
  // create/delete stay admin-only via requireAdmin below.
  const session = await auth()
  if (!session?.user) return err('Not signed in')
  // Every other action in the codebase validates the id shape before it
  // reaches the DB; this one used to pass the raw string through, so a
  // malformed id surfaced as a driver-level rejection rather than an error
  // the caller could render.
  const parsedId = z.uuid().safeParse(appId)
  if (!parsedId.success) return err('Invalid app')
  if (session.user.role !== 'admin' && !(await managesApp(session.user.id, parsedId.data))) {
    return err('Only an admin or this project’s manager can edit it')
  }

  const result = buildAppUpdate(input)
  if (!result.ok) return err(result.error)

  const [app] = await db
    .select({
      slug: apps.slug,
      name: apps.name,
      status: apps.status,
      leadId: apps.leadId,
      pmId: apps.pmId,
    })
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

  // Names are only worth a query when the id they belong to actually changed
  // — the common save (nothing here touched) must not pay for two lookups it
  // will then throw away, and summarizeAppChanges already no-ops when the
  // value is unchanged.
  const pmName =
    typeof result.set.pmId === 'string' && result.set.pmId !== app.pmId
      ? await nameForUser(result.set.pmId)
      : null
  const leadName =
    typeof result.set.leadId === 'string' && result.set.leadId !== app.leadId
      ? await nameForUser(result.set.leadId)
      : null

  const { detail, metadata } = summarizeAppChanges(
    { status: app.status, leadId: app.leadId, pmId: app.pmId },
    result.set,
    { pmName, leadName },
  )
  await logActivity({
    actorId: session.user.id,
    verb: 'updated',
    entityType: 'app',
    entityId: parsedId.data,
    entityLabel: name,
    appId: parsedId.data,
    appName: name,
    pagePath: `/apps/${app.slug}`,
    detail,
    metadata,
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
