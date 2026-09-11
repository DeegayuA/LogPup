import { createHmac, randomUUID } from 'node:crypto'
import { bridgeEmailAllowed } from '@/lib/bridge-auth'

/**
 * Task events pushed to the Attendance Web App, so an assignment reaches somebody's PHONE.
 *
 * WHY A WEBHOOK RATHER THAN THE POLL THAT ALREADY EXISTS. Attendance polls
 * `/api/external/tasks` every 60 seconds, so a newly assigned task APPEARS there on its own.
 * That is not a notification. A notification has to reach a person whose browser tab is closed,
 * and only a server-side push does that — a client poll cannot, by construction.
 *
 * BEST EFFORT, AND IT MUST STAY THAT WAY. Called after the assignment has already been written;
 * nothing thrown escapes. A failure here must never report a saved assignment as failed — the
 * same contract createNotifications itself keeps.
 *
 * WHAT A DROPPED POST COSTS, stated rather than engineered around: one missed interruption. The
 * task still arrives, because Attendance polls for it. That is the trade this repo's own daily
 * notification cap already makes on purpose — a capped day loses the interruption and not the
 * information. So there is deliberately NO outbox table and NO retry queue here: `notify-tick`
 * is explicit that everything periodic becomes an ordered step inside it rather than a third
 * vercel.json entry, which fails the deploy on Hobby.
 *
 * See docs/attendance-task-bridge.md, Part three.
 */

export type AttendanceEvent = {
  /** Stable per (notification, recipient). Attendance keys its bell document off it, so a
   *  retry overwrites the same row instead of ringing the bell twice. */
  eventId: string
  kind: 'task.assigned'
  occurredAt: string
  recipientEmail: string
  actorName: string
  title: string
  body: string | null
  link: string
  taskId: string
  appSlug: string | null
}

/** One short attempt. A notification is not worth holding a server action open for. */
const TIMEOUT_MS = 3000

export function attendanceWebhookConfigured(): boolean {
  return Boolean(process.env.ATTENDANCE_WEBHOOK_URL && process.env.LOGPUP_WEBHOOK_SECRET)
}

/**
 * One line per process, not one per assignment.
 *
 * An unconfigured bridge would otherwise log on every task anyone is ever assigned, which is how
 * a real warning becomes background noise people filter out.
 */
const warned = new Set<string>()
function warnOnce(message: string): void {
  if (warned.has(message)) return
  warned.add(message)
  console.warn(`[attendance-webhook] ${message}`)
}

export function newEventId(): string {
  return randomUUID()
}

/**
 * Sign and POST a batch.
 *
 * SIGNED, NOT KEYED. The HMAC covers `<timestamp>.<exact body bytes>`, so the timestamp cannot
 * be edited to extend the replay window of a captured request, and the receiver rejects a
 * timestamp more than five minutes old. A bearer key would be replayable forever from one
 * captured log line.
 *
 * The body is serialized ONCE and both signed and sent — signing a re-serialized copy produces
 * a different byte string (key order, whitespace) and the receiver would reject it for what
 * looks exactly like a wrong secret.
 */
export async function postEventsToAttendance(events: AttendanceEvent[]): Promise<void> {
  try {
    const url = process.env.ATTENDANCE_WEBHOOK_URL
    const secret = process.env.LOGPUP_WEBHOOK_SECRET
    if (!url || !secret) {
      // SAID OUT LOUD, ONCE PER PROCESS. A silent return here means every phone notification is
      // dropped forever and nothing anywhere reports it — the failure mode where the feature
      // looks shipped, the in-app rows appear, and nobody learns the pushes never arrived.
      warnOnce(
        'ATTENDANCE_WEBHOOK_URL / LOGPUP_WEBHOOK_SECRET not set — task assignments will not '
        + 'reach the Attendance app. In-app LogPup notifications are unaffected.',
      )
      return
    }

    // Filter BEFORE the request, never at the far end: a notification for somebody outside the
    // bridge's domains has no business leaving the building.
    const inScope = events.filter((e) => bridgeEmailAllowed(e.recipientEmail))
    if (inScope.length === 0) return

    const body = JSON.stringify({ events: inScope })
    const timestamp = String(Date.now())
    const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      // AWAITED, not fire-and-forget: on Vercel the function may be frozen the moment the
      // response is sent, and a floating promise is simply lost.
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-logpup-timestamp': timestamp,
          'x-logpup-signature': signature,
        },
        body,
        signal: controller.signal,
        cache: 'no-store',
      })
      if (!res.ok) {
        console.warn(`[attendance-webhook] ${res.status} for ${inScope.length} event(s)`)
      }
    } finally {
      clearTimeout(timer)
    }
  } catch (error) {
    // Unreachable, slow, misconfigured — the assignment already happened and stands.
    console.warn('[attendance-webhook] post failed:', (error as { message?: string })?.message ?? error)
  }
}
