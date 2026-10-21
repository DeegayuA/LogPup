import { NextResponse, type NextRequest } from 'next/server'
import { bridgeKeyValid, resolveBridgeUser } from '@/lib/bridge-auth'
import { getMyWorklogsInRange } from '@/features/worklog/queries'
import { listEntriesInRangeForDisplay } from '@/features/worklog/entry-queries'
import { assembleWorklogDays, parseWorklogParams } from '@/app/api/external/worklog'
import { externalBaseUrl } from '@/app/api/external/serialize'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The Attendance Web App asking "what has this person logged in their worklog?" — the days they
 * scored (daily_worklogs) and the time entries under them (worklog_entries), for a date range.
 *
 * READ-ONLY, and it stays that way: the worklog is a first-person statement about somebody's own
 * day (see the SELF-ONLY WRITES note on worklog_entries), so there is no write counterpart here.
 *
 * Same door as /api/external/tasks: the shared key identifies the calling application, the person
 * is named by `email` and re-derived by resolveBridgeUser (approved, active, not removed), and an
 * unknown person answers exactly like a person with nothing logged — never a distinguishable 404.
 */
export async function GET(req: NextRequest) {
  if (!bridgeKeyValid(req.headers.get('x-api-key'))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = parseWorklogParams(req.nextUrl.searchParams)
  if (!parsed.ok) {
    return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })
  }

  // The try covers resolveBridgeUser too — it queries Postgres, and a driver error must leave as
  // the sanitized 500 below, not as a stack trace (same reasoning as tasks/route.ts).
  try {
    const user = await resolveBridgeUser(parsed.email)
    if (!user) {
      return NextResponse.json({ success: true, matched: false, count: 0, data: [] })
    }

    const [headers, entries] = await Promise.all([
      getMyWorklogsInRange(user.id, parsed.from, parsed.to),
      listEntriesInRangeForDisplay(user.id, parsed.from, parsed.to),
    ])
    const data = assembleWorklogDays(headers, entries)

    return NextResponse.json(
      {
        success: true,
        matched: true,
        user: { id: user.id, email: user.email, name: user.name },
        from: parsed.from,
        to: parsed.to,
        count: data.length,
        data,
        url: `${externalBaseUrl()}/worklog`,
        timestamp: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('[external/worklog] query failed', error)
    return NextResponse.json({ success: false, error: 'Could not read worklog' }, { status: 500 })
  }
}
