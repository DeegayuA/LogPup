import { describe, expect, it } from 'vitest'
import { QueryBuilder } from 'drizzle-orm/pg-core'
import { liveTasks } from '@/db/live'
import { assignedTo, assignedToAny, completedBy, completedByAny, taskDayBetween } from './task-scope'

const UID = '11111111-1111-1111-1111-111111111111'
const compile = (cond: ReturnType<typeof completedBy>) =>
  new QueryBuilder().select({ id: liveTasks.id }).from(liveTasks).where(cond).toSQL()

describe('completedBy', () => {
  const { sql, params } = compile(completedBy(UID))

  it('only counts tasks that are done now — a reopened task is nobody\'s completion', () => {
    expect(sql).toContain(`"live_tasks"."status" = 'done'`)
  })

  // The LATEST completion decides: a task finished by one person, reopened, and finished by
  // another is the second person's.
  it('reads the latest completed row for this task from activity_log', () => {
    expect(sql).toContain('from "activity_log"')
    expect(sql).toContain(`"activity_log"."entity_type" = 'task'`)
    expect(sql).toContain(`"activity_log"."verb" = 'completed'`)
    expect(sql).toContain('"activity_log"."entity_id" = "live_tasks"."id"')
    expect(sql).toMatch(/order by "activity_log"\."created_at" desc limit 1/)
  })

  it('compares that row\'s actor with the person, as a bound parameter', () => {
    expect(sql).toContain('"activity_log"."actor_id"')
    expect(params).toContain(UID)
  })
})

describe('assignedTo', () => {
  it('is the owner column OR a task_assignees row', () => {
    const { sql, params } = compile(assignedTo(UID))
    expect(sql).toContain('"live_tasks"."assignee_id" =')
    expect(sql).toContain('from "task_assignees"')
    expect(params.filter((p) => p === UID)).toHaveLength(2)
  })
})

describe('taskDayBetween', () => {
  const { sql, params } = compile(taskDayBetween('2026-10-01', '2026-10-31'))

  // completed_at is timestamptz; created_at is a plain timestamp holding UTC wall time.
  it('takes the Colombo calendar day of completion, else the due date, else creation', () => {
    expect(sql).toContain(`coalesce(("live_tasks"."completed_at" at time zone 'Asia/Colombo')::date`)
    expect(sql).toContain('"live_tasks"."due_date"')
    expect(sql).toContain(`(("live_tasks"."created_at" at time zone 'UTC') at time zone 'Asia/Colombo')::date`)
  })

  it('bounds it inclusively by the two days, as bound parameters', () => {
    expect(sql).toMatch(/between \$\d+::date and \$\d+::date/)
    expect(params).toEqual(expect.arrayContaining(['2026-10-01', '2026-10-31']))
  })
})

describe('assignedToAny / completedByAny', () => {
  const IDS = [UID, '22222222-2222-2222-2222-222222222222']

  it('assignedToAny checks the owner column and task_assignees against the whole list', () => {
    const { sql, params } = compile(assignedToAny(IDS))
    expect(sql).toContain('"live_tasks"."assignee_id" in (')
    expect(sql).toContain('"task_assignees"."user_id" in (')
    expect(params.filter((p) => p === UID)).toHaveLength(2)
  })

  it('completedByAny checks the latest completion row against the whole list, done tasks only', () => {
    const { sql } = compile(completedByAny(IDS))
    expect(sql).toContain(`"live_tasks"."status" = 'done'`)
    expect(sql).toMatch(/order by "activity_log"\."created_at" desc limit 1\s*\) in \(/)
  })
})
