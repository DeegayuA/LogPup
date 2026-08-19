import { notFound } from 'next/navigation'
import { OrgHolidaysCard } from '@/features/worklog/components/org-holidays-card'
import { listOrgHolidays } from '@/features/worklog/org-holiday-queries'
import { loadActor } from '@/features/auth/actor'
import { can } from '@/features/auth/capabilities'

/**
 * Company holidays, composed on top of the gazetted Sri Lankan calendar.
 *
 * `holiday.manage` is deliberately unscoped (admin and superadmin, nobody
 * else) — there is no per-team variant here, because `org_holidays.day` is
 * globally UNIQUE: a holiday added on this page applies to every person in
 * the workspace, not one team or office.
 */
export default async function AdminHolidaysPage() {
  const actor = await loadActor()
  if (!actor || !can(actor, 'holiday.manage')) notFound()

  const holidays = await listOrgHolidays()

  return <OrgHolidaysCard holidays={holidays} />
}
