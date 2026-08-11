'use server'

import { randomBytes } from 'crypto'
import { z } from 'zod'
import { and, count, eq, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { apps, assignments, sprints, tasks, meetings, meetingAttendees, users } from '@/db/schema'
import { auth } from '@/lib/auth'
import { hashPassword } from '@/lib/password'
import { emailAllowed, allowedDomains } from '@/lib/allowed-domains'
import { orgForEmail } from '@/lib/org-from-domain'
import { normalizePhone } from '@/lib/phone'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { canEditUser, wouldLeaveNoAdmins } from '@/features/admin/permissions'
import { jobRoleInput } from '@/features/auth/title-schema'

// Temporary testing tool. Enabled only when ENABLE_DB_CLEAR=1 so it can be turned off
// (remove the flag) the moment testing is done. Wipes business data but KEEPS users,
// so the acting admin is not locked out.
const dbClearEnabled = () => process.env.ENABLE_DB_CLEAR === '1'

async function requireAdmin() {
  const session = await auth()
  if (session?.user?.role !== 'admin') return null
  return session
}

export async function clearTestData(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireAdmin()
  if (!session) return err('Admins only')
  if (!dbClearEnabled()) return err('DB clear is disabled (set ENABLE_DB_CLEAR=1)')
  if (String(formData.get('confirm') ?? '') !== 'CLEAR') {
    return err('Type CLEAR to confirm')
  }

  // Delete children before parents to respect foreign keys; users are preserved.
  await db.delete(meetingAttendees)
  await db.delete(meetings)
  await db.delete(tasks)
  await db.delete(sprints)
  await db.delete(assignments)
  await db.delete(apps)

  revalidatePath('/', 'layout')
  return ok(undefined)
}

const roleInput = z.enum(['admin', 'member'])

function revalidateAdminPaths() {
  revalidatePath('/admin')
  revalidatePath('/people')
  revalidatePath('/')
}

// A job role surfaces in more places than the admin table it is edited from:
// the People directory, each person's detail page, the header account menu
// (rendered by the (app) layout) and the teammate's own Profile, which now
// only reads it.
function revalidateJobRolePaths() {
  revalidateAdminPaths()
  revalidatePath('/people/[id]', 'page')
  revalidatePath('/profile')
}

// Counts active admins other than `excludeUserId` — used to check whether
// demoting/deactivating that user would leave zero active admins.
async function otherActiveAdminCount(excludeUserId: string): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(users)
    .where(
      and(
        eq(users.role, 'admin'),
        eq(users.active, true),
        // A pending admin must not count toward "there is still another
        // admin" — otherwise the last-admin guard below could be defeated.
        eq(users.status, 'approved'),
        ne(users.id, excludeUserId),
      ),
    )
  return row?.count ?? 0
}

export async function setUserRole(userId: string, role: 'admin' | 'member'): Promise<ActionResult> {
  const session = await requireAdmin()
  if (!session) return err('Admins only')
  if (!canEditUser(session.user.id, userId)) return err('Cannot change your own account')

  const parsed = roleInput.safeParse(role)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  if (parsed.data === 'member') {
    // Check-then-write: reads the target's current role, then (if it's an
    // admin) counts other active admins before writing. This isn't atomic
    // with the update below — two concurrent demotions of the last two
    // admins could both pass the check — but this is an internal admin-only
    // tool, and JWT re-validation on every request shrinks the exploitable
    // window to essentially nothing in practice.
    const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId))
    if (target?.role === 'admin') {
      const otherAdmins = await otherActiveAdminCount(userId)
      if (wouldLeaveNoAdmins(otherAdmins)) return err('Cannot remove the last admin')
    }
  }

  await db.update(users).set({ role: parsed.data }).where(eq(users.id, userId))
  revalidateAdminPaths()
  return ok(undefined)
}

export async function setUserActive(userId: string, active: boolean): Promise<ActionResult> {
  const session = await requireAdmin()
  if (!session) return err('Admins only')
  if (!canEditUser(session.user.id, userId)) return err('Cannot change your own account')

  const parsed = z.boolean().safeParse(active)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  if (parsed.data === false) {
    // Same check-then-write tradeoff as setUserRole above — see that comment.
    const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId))
    if (target?.role === 'admin') {
      const otherAdmins = await otherActiveAdminCount(userId)
      if (wouldLeaveNoAdmins(otherAdmins)) return err('Cannot remove the last admin')
    }
  }

  await db.update(users).set({ active: parsed.data }).where(eq(users.id, userId))
  revalidateAdminPaths()
  return ok(undefined)
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
  orgTags: orgTagsInput.default([]),
})

// Admin-created account: the teammate signs in with email + the starter
// password and is forced to set their own before doing anything else.
export async function createUser(
  input: unknown,
): Promise<ActionResult<{ starterPassword: string }>> {
  if (!(await requireAdmin())) return err('Admins only')

  const parsed = createUserInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const { email, name, role, title, phone, orgTags } = parsed.data

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
  try {
    await db.insert(users).values({
      email,
      name,
      role,
      title: title || null,
      phone: phone ? normalizePhone(phone) : null,
      orgTags: effectiveOrgTags,
      passwordHash: hashPassword(starterPassword),
      mustChangePassword: true,
      active: true,
      // An admin creating the account IS the vetting step — the 'pending'
      // column default is for open Google self-signup only (see
      // src/lib/auth.ts), which this path bypasses entirely.
      status: 'approved',
    })
  } catch {
    // Unique-email race between the check above and the insert.
    return err('A user with that email already exists')
  }

  revalidateAdminPaths()
  return ok({ starterPassword })
}

export async function setUserOrgTags(userId: string, tags: unknown): Promise<ActionResult> {
  if (!(await requireAdmin())) return err('Admins only')

  const parsedId = z.uuid().safeParse(userId)
  if (!parsedId.success) return err('Invalid user')

  const parsed = orgTagsInput.safeParse(tags)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  await db.update(users).set({ orgTags: parsed.data }).where(eq(users.id, parsedId.data))
  revalidateAdminPaths()
  return ok(undefined)
}

/**
 * Contact number behind the call button. Blank clears it. Admins set it for
 * anyone; a user sets their own through setOwnPhone (features/auth/actions).
 */
export async function setUserPhone(userId: string, phone: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return err('Admins only')

  const parsedId = z.uuid().safeParse(userId)
  if (!parsedId.success) return err('Invalid user')

  const trimmed = phone.trim()
  const value = trimmed === '' ? null : normalizePhone(trimmed)
  if (trimmed !== '' && value === null) return err('That does not look like a phone number')

  await db.update(users).set({ phone: value }).where(eq(users.id, parsedId.data))
  revalidateAdminPaths()
  return ok(undefined)
}

/**
 * Job role (users.title) — display metadata, distinct from the admin|member
 * permission enum on users.role, which this never touches. Blank clears it.
 *
 * ADMIN-ONLY, and this guard is the enforcement: there is no self-service
 * counterpart (the old setOwnTitle was deleted, not hidden — a server action
 * keeps a callable endpoint long after its button is gone). Hiding the control
 * for non-admins is presentation; requireAdmin() below is what actually stops
 * the write. It re-reads the role from the session on every call, so nothing
 * the client sends is trusted, and it fails closed: no session, an expired
 * session, or a member session all return before the update runs.
 *
 * No self-target guard, unlike setUserRole/setUserActive: an admin retitling
 * their own account can't lock anyone out.
 */
export async function setUserTitle(userId: string, title: unknown): Promise<ActionResult> {
  if (!(await requireAdmin())) return err('Admins only')

  const parsedId = z.uuid().safeParse(userId)
  if (!parsedId.success) return err('Invalid user')

  const parsed = jobRoleInput.safeParse(title)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  await db.update(users).set({ title: parsed.data || null }).where(eq(users.id, parsedId.data))
  revalidateJobRolePaths()
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
export async function approveUser(userId: string, role: 'admin' | 'member'): Promise<ActionResult> {
  if (!(await requireAdmin())) return err('Admins only')

  const parsed = approveUserInput.safeParse({ userId, role })
  if (!parsed.success) return err(parsed.error.issues[0].message)

  await db
    .update(users)
    .set({ status: 'approved', role: parsed.data.role })
    .where(eq(users.id, parsed.data.userId))
  revalidateAdminPaths()
  return ok(undefined)
}

// Dead-ends a self-signed-up user: status='rejected' denies sign-in outright
// from then on (see the signIn/jwt callbacks in src/lib/auth.ts) — there is
// currently no "un-reject" path back to pending or approved from this UI.
export async function rejectUser(userId: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return err('Admins only')

  const parsedId = z.uuid().safeParse(userId)
  if (!parsedId.success) return err('Invalid user')

  await db.update(users).set({ status: 'rejected' }).where(eq(users.id, parsedId.data))
  revalidateAdminPaths()
  return ok(undefined)
}
