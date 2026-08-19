import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { orgHolidays, users } from '@/db/schema'

export type OrgHolidayRow = {
  id: string
  day: string
  name: string
  note: string | null
  createdByName: string | null
  /** The day cancellation took effect, or null if still in force. See org-holidays.ts. */
  revokedFrom: string | null
}

/**
 * Every company holiday on file, soonest first — cancelled ones included.
 *
 * Read-only sibling of org-holiday-actions.ts (add/revoke) — kept in its own
 * file rather than added there so the two can be touched independently.
 * `createdByName` is a left join, not an inner one: the row that added a
 * holiday can outlive that user's account without the holiday itself
 * disappearing from the list.
 *
 * Cancelled rows are NOT filtered out: revocation is a date on the row, not a
 * delete (see the schema comment on `revokedFrom`), and the row still
 * occupies its `day` forever (that column stays UNIQUE). Hiding it would
 * leave an admin unable to see why a day stopped being exempt, or why a new
 * holiday can't be added on the same date.
 */
export async function listOrgHolidays(): Promise<OrgHolidayRow[]> {
  return db
    .select({
      id: orgHolidays.id,
      day: orgHolidays.day,
      name: orgHolidays.name,
      note: orgHolidays.note,
      createdByName: users.name,
      revokedFrom: orgHolidays.revokedFrom,
    })
    .from(orgHolidays)
    .leftJoin(users, eq(users.id, orgHolidays.createdBy))
    .orderBy(orgHolidays.day)
}
