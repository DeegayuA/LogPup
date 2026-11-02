import { and, eq, gt, lt, sql } from 'drizzle-orm'
import { db } from '@/db'
import { apps, tasks } from '@/db/schema'

/**
 * Task numbers come from apps.next_task_number via the assign_task_number
 * trigger (drizzle/0077). Product decision (2026-11-02): a project's live
 * tasks always read 1..n with no gaps, so deleting one shifts every later
 * number down by one — delete SHOP-2 and SHOP-3 becomes SHOP-2.
 *
 * THE COST, accepted by the user: a key written down outside LogPup (a
 * comment, chat, commit message, the external API's consumers) points at a
 * different task after a delete. Everything inside LogPup links by id.
 *
 * The trashed row gives its number up (the (app_id, number) unique index
 * covers trashed rows too), so a restore takes the next one — see
 * renumberRestoredTask.
 *
 * One db.batch = one transaction on neon-http. The apps update goes first so
 * its row lock holds off the trigger's increment from a concurrent create
 * until the shift is done. The shift goes via negative numbers because the
 * unique index is checked row by row and `number - 1` in place collides
 * whenever Postgres visits the rows out of order. Every step is gated on the
 * trashed row still holding its number, so a repeat call changes nothing.
 */
export async function compactTaskNumbersAfterDelete(input: {
  taskId: string
  appId: string
  number: number | null
}): Promise<void> {
  const { taskId, appId, number } = input
  if (number === null) return
  const stillHolds = sql`exists (
    select 1 from tasks t
    where t.id = ${taskId} and t.number = ${number} and t.deleted_at is not null
  )`
  await db.batch([
    db
      .update(apps)
      .set({ nextTaskNumber: sql`${apps.nextTaskNumber} - 1` })
      .where(and(eq(apps.id, appId), stillHolds)),
    db
      .update(tasks)
      .set({ number: sql`-(${tasks.number} - 1)` })
      .where(and(eq(tasks.appId, appId), gt(tasks.number, number), stillHolds)),
    db
      .update(tasks)
      .set({ number: null })
      .where(and(eq(tasks.id, taskId), eq(tasks.number, number))),
    db
      .update(tasks)
      .set({ number: sql`-${tasks.number}` })
      .where(and(eq(tasks.appId, appId), lt(tasks.number, 0))),
  ])
}

/** A restored task gave its number up on delete; it takes the app's next one. */
export async function renumberRestoredTask(taskId: string): Promise<void> {
  await db.execute(sql`
    with bumped as (
      update apps set next_task_number = next_task_number + 1
      where id = (select app_id from tasks where id = ${taskId} and number is null)
      returning next_task_number - 1 as n
    )
    update tasks set number = (select n from bumped)
    where id = ${taskId} and number is null and exists (select 1 from bumped)
  `)
}
