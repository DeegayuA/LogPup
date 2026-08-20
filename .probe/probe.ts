import { QueryBuilder, alias } from 'drizzle-orm/pg-core'
import { eq, asc } from 'drizzle-orm'
import { liveApps } from '../src/db/live'
import { users } from '../src/db/schema'

const qb = new QueryBuilder()
const lead = alias(users, 'lead')
const cols = liveApps._.selectedFields
console.log('keys:', Object.keys({ ...cols }))
const q = qb
  .select({ ...cols, leadName: lead.name })
  .from(liveApps)
  .leftJoin(lead, eq(liveApps.leadId, lead.id))
  .orderBy(asc(liveApps.name))
console.log(q.toSQL().sql)
