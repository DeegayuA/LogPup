'use server'

import { randomBytes } from 'crypto'
import { z } from 'zod'
import { and, count, eq, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import {
  apps, assignments, sprints, tasks, meetings, meetingAttendees, meetingAttendeeRecommendations,
  dailyWorklogs, userDeletions, users,
} from '@/db/schema'
import { requireCapability } from '@/features/auth/actor'
import { countTransferableWork } from '@/features/people/handover-queries'
import { EMPLOYMENT_TYPES, can, USER_ROLES, type UserRole } from '@/features/auth/capabilities'
import { hashPassword } from '@/lib/password'
import { resetPasswordFor } from '@/features/admin/starter-password'
import { emailAllowed, allowedDomains } from '@/lib/allowed-domains'
import { orgForEmail } from '@/lib/org-from-domain'
import { normalizePhone } from '@/lib/phone'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { canEditUser, wouldLeaveNoSuperadmins } from '@/features/admin/permissions'
import { canHoldWork } from '@/features/people/removal-queries'
import { jobRoleInput } from '@/features/auth/title-schema'
import { personalEmailInput } from '@/features/auth/personal-email-schema'
import { logActivity } from '@/features/activity/log'

// Temporary testing tool. Enabled only when ENABLE_DB_CLEAR=1 so it can be turned off
// (remove the flag) the moment testing is done. Wipes business data but KEEPS users,
// so the acting admin is not locked out.
const dbClearEnabled = () => process.env.ENABLE_DB_CLEAR === '1'

// The seven verbatim copies of `requireAdmin()` this file used to be one of
// are gone: every guard now names the capability it needs, and the matrix
// answers. Same contract as before — an Actor on success, null on refusal —
// so every call site keeps its `if (!actor) return err(...)` shape.

export async function clearTestData(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireCapability('danger.dbclear')
  if (!actor) return err('Admins only')
  if (!dbClearEnabled()) return err('DB clear is disabled (set ENABLE_DB_CLEAR=1)')
  if (String(formData.get('confirm') ?? '') !== 'CLEAR') {
    return err('Type CLEAR to confirm')
  }

  // Delete children before parents to respect foreign keys; users are preserved.
  //
  // activity_log is preserved TOO, and that is a decision rather than an
  // oversight: it is an audit trail, and a wipe is precisely the event it
  // most needs to have recorded (the row written below). Its entries carry
  // denormalized names — task titles, meeting titles — so those outlive the
  // rows they described, which is the whole reason they are denormalized.
  // If a wipe ever has to be total, the trail must be truncated explicitly
  // and visibly, not swept along by a list of business tables.
  //
  // daily_worklogs is the one per-person table this list has to name for
  // itself, and it was missed for years because its neighbour isn't. Sprint
  // check-ins vanish for free — they cascade from sprints, which is deleted
  // below — but a work log hangs off nothing except users, and users are
  // exactly what this tool keeps. Leaving it off the list left /worklog
  // reading back a full history of a workspace that no longer contained
  // anything: percentages and notes about apps and sprints that were gone.
  // The alternative worth naming is giving daily_worklogs an app or sprint
  // parent so it inherits a cascade like everything else here; that was
  // rejected because a work log is a statement about a person's day, not
  // about any one app, and inventing a parent to satisfy a delete list would
  // be a lie in the schema. So it gets its own line, and every future
  // per-person table will need one too.
  await db.delete(meetingAttendeeRecommendations)
  await db.delete(meetingAttendees)
  await db.delete(meetings)
  await db.delete(dailyWorklogs)
  await db.delete(tasks)
  await db.delete(sprints)
  await db.delete(assignments)
  await db.delete(apps)

  // One row for the whole wipe — the deleted rows themselves are gone, so
  // there is nothing more granular worth naming.
  await logActivity({
    actorId: actor.id,
    verb: 'deleted',
    entityType: 'user',
    entityId: actor.id,
    entityLabel: 'test data',
    pagePath: '/admin',
    detail: 'cleared all business data',
  })

  revalidatePath('/', 'layout')
  return ok(undefined)
}

const roleInput = z.enum(USER_ROLES)

function revalidateAdminPaths() {
  revalidatePath('/admin')
  revalidatePath('/people')
  revalidatePath('/')
}

// Profile fields (job role, personal email) surface in more places than the
// admin table they are edited from: the People directory, each person's
// detail page, the header account menu (rendered by the (app) layout) and the
// teammate's own Profile, which only reads them.
function revalidateUserDetailPaths() {
  revalidateAdminPaths()
  revalidatePath('/people/[id]', 'page')
  revalidatePath('/profile')
}

// Counts REACHABLE superadmins other than `excludeUserId` — used to check
// whether demoting/deactivating/removing that user would leave the workspace
// with nobody who can grant superadmin again.
//
// `canHoldWork()`, not `active && approved`. The question this answers is not
// "does another superadmin row exist" but "is there another superadmin who
// could undo this", and a REMOVED superadmin cannot sign in at all — counting
// them is the same mistake as counting a pending one, which the comment below
// already warned about. Left uncounted, the last usable superadmin could be
// demoted, deactivated or removed while a tombstoned account stood in as the
// safety net, and the way back is restorePerson, which itself needs an admin.
async function otherActiveSuperadminCount(excludeUserId: string): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(users)
    .where(
      and(
        eq(users.role, 'superadmin'),
        // A pending superadmin must not count toward "there is still another
        // one" — otherwise the last-superadmin guard could be defeated by
        // inviting somebody who has not accepted yet. Same for a deactivated
        // or removed one, which is why this is the shared roster predicate.
        canHoldWork(),
        ne(users.id, excludeUserId),
      ),
    )
  return row?.count ?? 0
}

/**
 * Walks an error's `.cause` chain looking for a Postgres unique-violation.
 * Third copy of these ten lines (see src/features/people/actions.ts and
 * src/features/admin/trash-actions.ts) for the reason those two give: the
 * cause-chain walk is small, and reaching into another feature's private
 * helper to share it would couple three modules for nothing.
 */
function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error
  const seen = new Set<unknown>()
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    const e = current as { code?: unknown; message?: unknown; cause?: unknown }
    if (e.code === '23505') return true
    if (typeof e.message === 'string' && e.message.includes('duplicate key')) return true
    current = e.cause
  }
  return false
}

const removalReasonInput = z
  .string()
  .trim()
  .max(200, 'Keep the reason to 200 characters or fewer')
  .optional()

/**
 * Removes somebody from the workspace: they can no longer sign in by any
 * method, and they stop appearing anywhere work is handed out.
 *
 * WHAT THIS DOES NOT TOUCH, and the whole design rests on it: users.active,
 * users.role, and every row they ever wrote. Removal opens an interval in
 * user_deletions and nothing else. Their name still renders on their past
 * comments, work logs and meetings, because those joins read `users`
 * directly and never consult this table (see the schema.ts comment on
 * userDeletions, and src/features/people/removal-queries.ts).
 *
 * NOT setUserActive. Deactivation leaves the account able to sign in and be
 * told it is deactivated; removal is the heavier state with no session at
 * all, which is why it has its own capability rather than riding on
 * user.deactivate's scoped arm — a manager may stand their own team down,
 * but deciding somebody is no longer part of the studio is not project work.
 *
 * Reversible from admin Trash (restorePerson in trash-actions.ts), and
 * deliberately never purgeable: purging would mean hard-deleting the users
 * row, which cascades away the work the tombstone shape exists to preserve.
 */
export async function removeUser(userId: string, reason?: string): Promise<ActionResult> {
  const actor = await requireCapability('user.remove')
  if (!actor) return err('Admins only')
  // Same self-guard as setUserRole/setUserActive, and it matters more here:
  // an admin who removes themselves loses the session that would let them
  // undo it on the very next request.
  if (!canEditUser(actor.id, userId)) return err('Cannot remove your own account')

  const parsedId = z.uuid().safeParse(userId)
  if (!parsedId.success) return err('Invalid user')

  const parsedReason = removalReasonInput.safeParse(reason)
  if (!parsedReason.success) return err(parsedReason.error.issues[0].message)

  const [target] = await db
    .select({ name: users.name, role: users.role })
    .from(users)
    .where(eq(users.id, parsedId.data))
  if (!target) return err('That person no longer exists')

  // The same last-superadmin guard the role and active changes already use,
  // with the same check-then-write tradeoff (see setUserRole's comment).
  // Specifically superadmin, not the admin family: superadmin is the only
  // seat that can grant superadmin, so a workspace with none has no route
  // back. Checked against the TARGET's current role, not the actor's.
  if (target.role === 'superadmin') {
    const others = await otherActiveSuperadminCount(parsedId.data)
    if (wouldLeaveNoSuperadmins(others)) return err('Cannot remove the last superadmin')
  }

  // No read-then-insert: user_deletions_one_open_idx already allows at most
  // one open interval per person, so the insert IS the check — and unlike a
  // preceding SELECT it cannot lose a race with a second admin clicking
  // Remove at the same moment.
  try {
    await db.insert(userDeletions).values({
      userId: parsedId.data,
      removedBy: actor.id,
      reason: parsedReason.data || null,
    })
  } catch (error) {
    if (isUniqueViolation(error)) return err('They have already been removed')
    throw error
  }

  await logActivity({
    actorId: actor.id,
    verb: 'deleted',
    entityType: 'user',
    entityId: parsedId.data,
    entityLabel: target.name,
    pagePath: `/people/${parsedId.data}`,
    detail: parsedReason.data
      ? `removed from the workspace — ${parsedReason.data}`
      : 'removed from the workspace',
    metadata: { removal: { reason: parsedReason.data || null } },
  })
  revalidateUserDetailPaths()
  return ok(undefined)
}

export async function setUserRole(userId: string, role: UserRole): Promise<ActionResult> {
  const actor = await requireCapability('user.role.grant')
  if (!actor) return err('Admins only')
  if (!canEditUser(actor.id, userId)) return err('Cannot change your own account')

  // Granting the top seat needs the top seat. This is the one place where a
  // capability check depends on the VALUE being written rather than the row
  // being written to, so it cannot live in the matrix lookup above.
  if (role === 'superadmin' && !can(actor, 'user.role.grant.superadmin')) {
    return err('Only a superadmin can grant superadmin')
  }

  const parsed = roleInput.safeParse(role)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  // Read name + current role up front: the name labels the activity row, the
  // role is both the before value and the input to the last-admin check.
  const [target] = await db
    .select({ name: users.name, role: users.role })
    .from(users)
    .where(eq(users.id, userId))

  if (parsed.data === 'member') {
    // Check-then-write: reads the target's current role, then (if it's an
    // admin) counts other active admins before writing. This isn't atomic
    // with the update below — two concurrent demotions of the last two
    // admins could both pass the check — but this is an internal admin-only
    // tool, and JWT re-validation on every request shrinks the exploitable
    // window to essentially nothing in practice.
    // Specifically superadmin, not the admin family: superadmin is the only
    // seat that can grant superadmin, so a workspace with none has no route
    // back. An admin-less workspace is recoverable; a superadmin-less one is
    // not. Checked against the TARGET's current role, not the actor's.
    if (target?.role === 'superadmin') {
      const others = await otherActiveSuperadminCount(userId)
      if (wouldLeaveNoSuperadmins(others)) return err('Cannot remove the last superadmin')
    }
  }

  await db.update(users).set({ role: parsed.data }).where(eq(users.id, userId))
  await logActivity({
    actorId: actor.id,
    verb: 'updated',
    entityType: 'user',
    entityId: userId,
    entityLabel: target?.name ?? 'Unknown user',
    pagePath: `/people/${userId}`,
    detail: `role to ${parsed.data}`,
    metadata: { role: { from: target?.role, to: parsed.data } },
  })
  revalidateAdminPaths()
  return ok(undefined)
}

export async function setUserActive(
  userId: string,
  active: boolean,
  /**
   * Deactivate even though they still hold transferable work.
   *
   * Deliberately explicit rather than a force flag with a default: closing
   * somebody's access while their projects, roles and open tasks stay pinned
   * to a login nobody can use is a real choice, and it should be one an
   * operator makes on purpose and leaves a trail for.
   */
  acknowledgeUntransferred = false,
): Promise<ActionResult> {
  const actor = await requireCapability('user.deactivate', { ownerId: userId })
  if (!actor) return err('Admins only')
  if (!canEditUser(actor.id, userId)) return err('Cannot change your own account')

  const parsed = z.boolean().safeParse(active)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  // The gate that makes handover happen rather than be optional. Only on the
  // way OUT — reactivating somebody is never blocked.
  if (!active && !acknowledgeUntransferred) {
    const outstanding = await countTransferableWork(userId)
    if (outstanding > 0) {
      return err(
        `They still hold ${outstanding} ${outstanding === 1 ? 'item' : 'items'} of open work. ` +
        'Hand it over first, or deactivate anyway and record why.',
      )
    }
  }

  // Same up-front read as setUserRole: name for the activity row, role for
  // the last-admin check, active as the before value.
  const [target] = await db
    .select({ name: users.name, role: users.role, active: users.active })
    .from(users)
    .where(eq(users.id, userId))

  if (parsed.data === false) {
    // Same check-then-write tradeoff as setUserRole above — see that comment.
    // Specifically superadmin, not the admin family: superadmin is the only
    // seat that can grant superadmin, so a workspace with none has no route
    // back. An admin-less workspace is recoverable; a superadmin-less one is
    // not. Checked against the TARGET's current role, not the actor's.
    if (target?.role === 'superadmin') {
      const others = await otherActiveSuperadminCount(userId)
      if (wouldLeaveNoSuperadmins(others)) return err('Cannot remove the last superadmin')
    }
  }

  await db.update(users).set({ active: parsed.data }).where(eq(users.id, userId))
  await logActivity({
    actorId: actor.id,
    verb: 'updated',
    entityType: 'user',
    entityId: userId,
    entityLabel: target?.name ?? 'Unknown user',
    pagePath: `/people/${userId}`,
    detail: parsed.data ? 'account active' : 'account inactive',
    metadata: { active: { from: target?.active, to: parsed.data } },
  })
  revalidateAdminPaths()
  return ok(undefined)
}

/**
 * Puts the shared starter password back on an account, and forces the owner to
 * replace it on their next sign-in.
 *
 * The point is the second half. `mustChangePassword` is not decoration here:
 * the proxy (src/proxy.ts) pins a session carrying it to /profile until
 * setOwnPassword clears it, so the reset password is only ever usable to set a
 * real one. Removing that flag would leave a workspace-wide known password on
 * a live account indefinitely.
 *
 * SELF-RESET IS REFUSED, via the same canEditUser guard setUserRole and
 * setUserActive use. An admin resetting their OWN password to the shared
 * constant would lock the workspace's own operator behind a password everyone
 * knows, and they already have a real way to change it in /profile.
 *
 * The password is returned so the caller can show it — a reset nobody can
 * read out is a reset that strands somebody. It is the same value every time
 * TODAY (see starter-password.ts); returning it rather than assuming it is
 * what makes switching to a random per-user value a one-line change.
 */
export async function resetUserPassword(
  userId: string,
): Promise<ActionResult<{ password: string }>> {
  const actor = await requireCapability('user.password.reset')
  if (!actor) return err('Admins only')
  if (!canEditUser(actor.id, userId)) {
    return err('Use Profile to change your own password')
  }

  const [target] = await db
    .select({ name: users.name, active: users.active })
    .from(users)
    .where(eq(users.id, userId))
  if (!target) return err('User not found')

  const password = resetPasswordFor()
  await db
    .update(users)
    .set({ passwordHash: hashPassword(password), mustChangePassword: true })
    .where(eq(users.id, userId))

  // Logged because this is somebody taking control of another person's
  // account, which is exactly the class of act an audit trail exists for.
  // The password itself is NEVER written to the log — it would put a live
  // credential in a table half the workspace can read.
  await logActivity({
    actorId: actor.id,
    verb: 'updated',
    entityType: 'user',
    entityId: userId,
    entityLabel: target.name,
    pagePath: `/people/${userId}`,
    detail: 'password reset to the starter password',
  })
  revalidateAdminPaths()
  return ok({ password })
}

// Every admin-created account starts with a RANDOM per-user starter password
// (shown once to the admin) and mustChangePassword=true, so the proxy pins the
// user to /profile until they replace it (see src/proxy.ts). A shared constant
// starter would let anyone who knows an invitee's email take the account
// before their first sign-in.

const orgTagsInput = z
  .array(
    z
      .string()
      .trim()
      .min(1, 'Organization tags cannot be empty')
      .max(30, 'Organization tags must be 30 characters or fewer'),
  )
  .max(8, 'Up to 8 organization tags per user')
  .transform((tags) => Array.from(new Set(tags)))

const createUserInput = z.object({
  email: z.preprocess(
    (v) => String(v ?? '').trim().toLowerCase(),
    z.email('Enter a valid email address'),
  ),
  name: z.string().trim().min(1, 'Name is required').max(80, 'Name must be 80 characters or fewer'),
  role: roleInput.default('member'),
  title: jobRoleInput.optional(),
  // Optional at creation — an admin can add it later from the user table.
  // The teammate can't: users.title is admin-only.
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .refine((value) => !value || normalizePhone(value) !== null, {
      message: 'That does not look like a phone number',
    }),
  // Contact-only second address. Not checked against emailAllowed() and not
  // checked for uniqueness — see the column comment in db/schema.ts.
  personalEmail: personalEmailInput.optional(),
  orgTags: orgTagsInput.default([]),
})

// Admin-created account: the teammate signs in with email + the starter
// password and is forced to set their own before doing anything else.
export async function createUser(
  input: unknown,
): Promise<ActionResult<{ starterPassword: string }>> {
  const actor = await requireCapability('user.create')
  if (!actor) return err('Admins only')

  const parsed = createUserInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const { email, name, role, title, phone, personalEmail, orgTags } = parsed.data

  // Sign-in is domain-gated (every provider funnels through emailAllowed), so
  // an account outside the allowlist would be a locked door — refuse up front.
  if (!emailAllowed(email)) {
    const domain = email.slice(email.lastIndexOf('@') + 1)
    return err(
      `${domain} isn't an allowed sign-in domain — this user could never log in. Allowed: ${allowedDomains().join(', ') || '(none configured)'}`,
    )
  }

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email))
  if (existing) return err('A user with that email already exists')

  // No org tags picked by hand — fall back to whatever the email domain implies
  // (see src/lib/org-from-domain.ts) rather than leaving the column empty.
  const derivedOrg = orgForEmail(email)
  const effectiveOrgTags = orgTags.length > 0 ? orgTags : derivedOrg ? [derivedOrg] : []

  const starterPassword = randomBytes(6).toString('base64url')
  let createdId: string
  try {
    const [created] = await db
      .insert(users)
      .values({
        email,
        name,
        role,
        title: title || null,
        phone: phone ? normalizePhone(phone) : null,
        personalEmail: personalEmail || null,
        orgTags: effectiveOrgTags,
        passwordHash: hashPassword(starterPassword),
        mustChangePassword: true,
        active: true,
        // An admin creating the account IS the vetting step — the 'pending'
        // column default is for open Google self-signup only (see
        // src/lib/auth.ts), which this path bypasses entirely.
        status: 'approved',
      })
      .returning({ id: users.id })
    createdId = created.id
  } catch {
    // Unique-email race between the check above and the insert.
    return err('A user with that email already exists')
  }

  await logActivity({
    actorId: actor.id,
    verb: 'created',
    entityType: 'user',
    entityId: createdId,
    entityLabel: name,
    pagePath: `/people/${createdId}`,
    detail: `as ${role}`,
  })

  revalidateAdminPaths()
  return ok({ starterPassword })
}

export async function setUserOrgTags(userId: string, tags: unknown): Promise<ActionResult> {
  const actor = await requireCapability('user.profile.edit', { ownerId: userId })
  if (!actor) return err('Admins only')

  const parsedId = z.uuid().safeParse(userId)
  if (!parsedId.success) return err('Invalid user')

  const parsed = orgTagsInput.safeParse(tags)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const [target] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, parsedId.data))

  await db.update(users).set({ orgTags: parsed.data }).where(eq(users.id, parsedId.data))
  await logActivity({
    actorId: actor.id,
    verb: 'updated',
    entityType: 'user',
    entityId: parsedId.data,
    entityLabel: target?.name ?? 'Unknown user',
    pagePath: `/people/${parsedId.data}`,
    detail: 'organization tags',
    metadata: { orgTags: { to: parsed.data } },
  })
  revalidateAdminPaths()
  return ok(undefined)
}

/**
 * Contact number behind the call button. Blank clears it. Admins set it for
 * anyone; a user sets their own through setOwnPhone (features/auth/actions).
 */
export async function setUserPhone(userId: string, phone: string): Promise<ActionResult> {
  const actor = await requireCapability('user.profile.edit', { ownerId: userId })
  if (!actor) return err('Admins only')

  const parsedId = z.uuid().safeParse(userId)
  if (!parsedId.success) return err('Invalid user')

  const trimmed = phone.trim()
  const value = trimmed === '' ? null : normalizePhone(trimmed)
  if (trimmed !== '' && value === null) return err('That does not look like a phone number')

  const [target] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, parsedId.data))

  await db.update(users).set({ phone: value }).where(eq(users.id, parsedId.data))
  await logActivity({
    actorId: actor.id,
    verb: 'updated',
    entityType: 'user',
    entityId: parsedId.data,
    entityLabel: target?.name ?? 'Unknown user',
    pagePath: `/people/${parsedId.data}`,
    detail: 'phone number',
    metadata: { phone: { to: value } },
  })
  revalidateAdminPaths()
  return ok(undefined)
}

/**
 * Second, contact-only address (users.personal_email). Blank clears it.
 *
 * ADMIN-ONLY, and the capability guard below is the enforcement — there is no
 * self-service counterpart, same as setUserTitle. It re-reads the role from
 * the session on every call and fails closed.
 *
 * This never touches users.email. That column is the sign-in identity: it is
 * unique, domain-gated by emailAllowed(), and the lookup key for every
 * provider. Writing an address here can therefore neither create a second
 * login nor collide with anyone else's account.
 */
export async function setUserPersonalEmail(userId: string, email: unknown): Promise<ActionResult> {
  const actor = await requireCapability('user.profile.edit', { ownerId: userId })
  if (!actor) return err('Admins only')

  const parsedId = z.uuid().safeParse(userId)
  if (!parsedId.success) return err('Invalid user')

  const parsed = personalEmailInput.safeParse(email)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const [target] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, parsedId.data))

  await db
    .update(users)
    .set({ personalEmail: parsed.data || null })
    .where(eq(users.id, parsedId.data))
  await logActivity({
    actorId: actor.id,
    verb: 'updated',
    entityType: 'user',
    entityId: parsedId.data,
    entityLabel: target?.name ?? 'Unknown user',
    pagePath: `/people/${parsedId.data}`,
    detail: 'personal email',
    metadata: { personalEmail: { to: parsed.data || null } },
  })
  revalidateUserDetailPaths()
  return ok(undefined)
}

/**
 * Job role (users.title) — display metadata, distinct from the admin|member
 * permission enum on users.role, which this never touches. Blank clears it.
 *
 * ADMIN-ONLY, and this guard is the enforcement: there is no self-service
 * counterpart (the old setOwnTitle was deleted, not hidden — a server action
 * keeps a callable endpoint long after its button is gone). Hiding the control
 * for non-admins is presentation; the capability guard below is what actually stops
 * the write. It re-reads the role from the session on every call, so nothing
 * the client sends is trusted, and it fails closed: no session, an expired
 * session, or a member session all return before the update runs.
 *
 * No self-target guard, unlike setUserRole/setUserActive: an admin retitling
 * their own account can't lock anyone out.
 */
export async function setUserTitle(userId: string, title: unknown): Promise<ActionResult> {
  const actor = await requireCapability('user.profile.edit', { ownerId: userId })
  if (!actor) return err('Admins only')

  const parsedId = z.uuid().safeParse(userId)
  if (!parsedId.success) return err('Invalid user')

  const parsed = jobRoleInput.safeParse(title)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const [target] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, parsedId.data))

  await db.update(users).set({ title: parsed.data || null }).where(eq(users.id, parsedId.data))
  await logActivity({
    actorId: actor.id,
    verb: 'updated',
    entityType: 'user',
    entityId: parsedId.data,
    entityLabel: target?.name ?? 'Unknown user',
    pagePath: `/people/${parsedId.data}`,
    detail: 'job role',
    metadata: { title: { to: parsed.data || null } },
  })
  revalidateUserDetailPaths()
  return ok(undefined)
}

const approveUserInput = z.object({
  userId: z.uuid('Invalid user'),
  role: roleInput,
})

// Moves a self-signed-up user (see listPendingUsers) from 'pending' to
// 'approved' and sets their role in the same write — the admin picks the
// role right there on the pending-approvals row, there's no separate step.
// No canEditUser self-target guard: a pending user is never the acting
// admin's own account (an admin session already implies status='approved').
export async function approveUser(userId: string, role: UserRole): Promise<ActionResult> {
  const actor = await requireCapability('user.approve')
  if (!actor) return err('Admins only')

  const parsed = approveUserInput.safeParse({ userId, role })
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const [target] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, parsed.data.userId))

  await db
    .update(users)
    .set({ status: 'approved', role: parsed.data.role })
    .where(eq(users.id, parsed.data.userId))
  await logActivity({
    actorId: actor.id,
    verb: 'approved',
    entityType: 'user',
    entityId: parsed.data.userId,
    entityLabel: target?.name ?? 'Unknown user',
    pagePath: `/people/${parsed.data.userId}`,
    detail: `as ${parsed.data.role}`,
  })
  revalidateAdminPaths()
  return ok(undefined)
}

// Dead-ends a self-signed-up user: status='rejected' denies sign-in outright
// from then on (see the signIn/jwt callbacks in src/lib/auth.ts) — there is
// currently no "un-reject" path back to pending or approved from this UI.
export async function rejectUser(userId: string): Promise<ActionResult> {
  const actor = await requireCapability('user.approve')
  if (!actor) return err('Admins only')

  const parsedId = z.uuid().safeParse(userId)
  if (!parsedId.success) return err('Invalid user')

  const [target] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, parsedId.data))

  await db.update(users).set({ status: 'rejected' }).where(eq(users.id, parsedId.data))
  await logActivity({
    actorId: actor.id,
    verb: 'rejected',
    entityType: 'user',
    entityId: parsedId.data,
    entityLabel: target?.name ?? 'Unknown user',
    pagePath: `/people/${parsedId.data}`,
  })
  revalidateAdminPaths()
  return ok(undefined)
}

const employmentInput = z.object({
  userId: z.string().uuid(),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  supervisorId: z.string().uuid().nullable().optional(),
})

/**
 * Where somebody is in their employment — separate from their seat, and it
 * only ever CAPS what that seat may sign off.
 *
 * A person may never set their own, even though user.profile.edit resolves
 * 'own' for several seats: this field decides what they are allowed to
 * approve, and a control over your own approval powers is not a profile
 * field. Asserted by test.
 */
export async function setUserEmploymentType(
  raw: z.input<typeof employmentInput>,
): Promise<ActionResult> {
  const parsed = employmentInput.safeParse(raw)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const { userId, employmentType: type, supervisorId } = parsed.data

  const actor = await requireCapability('user.profile.edit', { ownerId: userId })
  if (!actor) return err('Not allowed')
  if (actor.id === userId) return err('You cannot change your own employment type')

  // A trainee or an intern is somebody being taught. Who is teaching them is
  // the point, so it is required — in the action rather than as a database
  // constraint, which would make changing a type able to fail a migration.
  if ((type === 'trainee' || type === 'intern') && !supervisorId) {
    return err('A trainee or intern needs a named supervisor')
  }
  if (supervisorId === userId) return err('Somebody cannot supervise themselves')

  try {
    const [before] = await db
      .select({ name: users.name, employmentType: users.employmentType })
      .from(users)
      .where(eq(users.id, userId))
    if (!before) return err('That person no longer exists')

    await db
      .update(users)
      .set({ employmentType: type, supervisorId: supervisorId ?? null })
      .where(eq(users.id, userId))

    await logActivity({
      actorId: actor.id,
      verb: 'updated',
      entityType: 'user',
      entityId: userId,
      entityLabel: before.name,
      detail: `employment ${before.employmentType} to ${type}`,
    })

    revalidatePath('/admin', 'layout')
    return ok(undefined)
  } catch (error) {
    console.error('[admin] setUserEmploymentType', error)
    return err('Something went wrong — try again')
  }
}
