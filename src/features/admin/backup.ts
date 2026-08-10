import { createCipheriv, createHash, randomBytes } from 'node:crypto'
import { db } from '@/db'
import { users, apps, assignments, sprints, tasks, meetings, meetingAttendees } from '@/db/schema'

// A backup contains password hashes and Google refresh tokens, so the JSON is
// AES-256-GCM encrypted before it ever leaves the process. Output layout:
//   iv(12 bytes) || authTag(16 bytes) || ciphertext, base64-encoded.
function encryptionKey(): Buffer {
  const secret = process.env.BACKUP_ENCRYPTION_KEY
  if (!secret) throw new Error('BACKUP_ENCRYPTION_KEY is not set')
  return createHash('sha256').update(secret).digest() // 32 bytes
}

// Explicit column list for the users export — deliberately excludes passwordHash and
// googleRefreshToken. A backup is broader-access than the running app (it lands in
// Blob storage and gets decrypted by whoever holds BACKUP_ENCRYPTION_KEY), so it must
// not carry credentials that would let someone impersonate a user or their Google
// account. Add new non-secret columns here explicitly; never widen this to select(*).
const backupUserColumns = {
  id: users.id,
  email: users.email,
  name: users.name,
  avatarUrl: users.avatarUrl,
  title: users.title,
  role: users.role,
  active: users.active,
  createdAt: users.createdAt,
}

export async function buildSnapshot() {
  const [
    usersRows, appsRows, assignmentsRows, sprintsRows, tasksRows, meetingsRows, attendeesRows,
  ] = await Promise.all([
    db.select(backupUserColumns).from(users),
    db.select().from(apps),
    db.select().from(assignments),
    db.select().from(sprints),
    db.select().from(tasks),
    db.select().from(meetings),
    db.select().from(meetingAttendees),
  ])
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    tables: {
      users: usersRows,
      apps: appsRows,
      assignments: assignmentsRows,
      sprints: sprintsRows,
      tasks: tasksRows,
      meetings: meetingsRows,
      meetingAttendees: attendeesRows,
    },
  }
}

export function encryptSnapshot(snapshot: unknown): Buffer {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const plaintext = Buffer.from(JSON.stringify(snapshot), 'utf8')
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, ciphertext])
}
