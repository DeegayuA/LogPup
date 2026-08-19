import { createCipheriv, createHash, randomBytes } from 'node:crypto'
import { db } from '@/db'
import {
  users, apps, assignments, sprints, tasks, meetings, meetingApps, meetingAttendees, meetingAiNotes,
  meetingAttendeeRecommendations,
} from '@/db/schema'

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
  orgTags: users.orgTags,
  role: users.role,
  active: users.active,
  createdAt: users.createdAt,
}

export async function buildSnapshot() {
  const [
    usersRows, appsRows, assignmentsRows, sprintsRows, tasksRows, meetingsRows, meetingAppsRows,
    attendeesRows, aiNotesRows, attendeeRecommendationsRows,
  ] = await Promise.all([
    db.select(backupUserColumns).from(users),
    db.select().from(apps),
    db.select().from(assignments),
    db.select().from(sprints),
    db.select().from(tasks),
    db.select().from(meetings),
    // Which projects each meeting is on. Not derivable from anything else in
    // the export: meetings.app_id carries ONE of them (a deprecated mirror,
    // see the comment on the column in src/db/schema.ts), so a restore built
    // from meetings alone would silently drop every other project off every
    // joint meeting.
    db.select().from(meetingApps),
    db.select().from(meetingAttendees),
    // Meeting transcripts/notes are irreplaceable (Gemini output, not
    // re-derivable from anything else in the DB) — must be backed up.
    // geminiKeys stays excluded: those are per-user secrets, not data.
    db.select().from(meetingAiNotes),
    // Recommender output is re-derivable in principle (the scorer can rerun),
    // but the reason ledger and any AI-override/dismissed state are not —
    // backing it up avoids re-litigating a dismissed suggestion after a restore.
    db.select().from(meetingAttendeeRecommendations),
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
      meetingApps: meetingAppsRows,
      meetingAttendees: attendeesRows,
      meetingAiNotes: aiNotesRows,
      meetingAttendeeRecommendations: attendeeRecommendationsRows,
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
