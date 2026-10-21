import { describe, expect, it } from 'vitest'
import { QueryBuilder } from 'drizzle-orm/pg-core'
import { liveTasks } from '@/db/live'
import { assignedTo, completedBy } from './task-scope'

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
