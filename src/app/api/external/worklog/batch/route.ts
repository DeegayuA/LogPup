import { NextResponse, type NextRequest } from 'next/server'
import { bridgeKeyValid, resolveBridgeUsers } from '@/lib/bridge-auth'
import { getWorklogsInRangeForUsers } from '@/features/worklog/queries'
import { listEntriesInRangeForUsers } from '@/features/worklog/entry-queries'
import { assembleWorklogDays, groupByUser, parseWorklogBatchBody } from '@/app/api/external/worklog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Several people's worklogs for one date range, in one call — the Attendance team views
 * (a supervisor's reports, or a whole company for back-office roles).
 *
 * WHO MAY SEE WHOM IS DECIDED BY ATTENDANCE, NOT HERE. This endpoint authenticates the calling
 * application (the shared key) and resolves each address with the same canHoldWork() rule as the
 * single-person endpoint; the Attendance proxy is what restricts the list to people the signed-in
 * viewer may see in its own team view, before it ever reaches this route. Read-only, like
 * GET /api/external/worklog.
 *
 * POST because the address list belongs in a body, not a query string that lands in logs. Every
 * requested address gets a result, and an unknown one answers exactly like a person with nothing
 * logged — never a distinguishable miss.
 */
export async function POST(req: NextRequest) {
  if (!bridgeKeyValid(req.headers.get('x-api-key'))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = parseWorklogBatchBody(await req.json().catch(() => null))
  if (!parsed.ok) {
    return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })
  }

  try {
    const found = await resolveBridgeUsers(parsed.emails)
    const ids = found.map((u) => u.id)
    const [headers, entries] = await Promise.all([
      getWorklogsInRangeForUsers(ids, parsed.from, parsed.to),
      listEntriesInRangeForUsers(ids, parsed.from, parsed.to),
    ])
    const headersBy = groupByUser(ids, headers)
    const entriesBy = groupByUser(ids, entries)
    const byEmail = new Map(found.map((u) => [u.email, u]))

    const results = parsed.emails.map((email) => {
      const user = byEmail.get(email)
      if (!user) return { email, matched: false, days: [] }
      return {
        email,
        matched: true,
        days: assembleWorklogDays(headersBy.get(user.id) ?? [], entriesBy.get(user.id) ?? []),
      }
    })

    return NextResponse.json(
      { success: true, from: parsed.from, to: parsed.to, results, timestamp: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('[external/worklog/batch] query failed', error)
    return NextResponse.json({ success: false, error: 'Could not read worklogs' }, { status: 500 })
  }
}
