import { neon } from '@neondatabase/serverless'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  const sql = neon(url)

  const usersCols = await sql`
    select column_name, data_type, is_nullable, column_default
    from information_schema.columns
    where table_name = 'users'
    order by ordinal_position
  `
  console.log('users columns:', JSON.stringify(usersCols, null, 2))

  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_name in ('notifications','users')
    order by table_name
  `
  console.log('tables present:', JSON.stringify(tables, null, 2))

  const userCount = await sql`select count(*)::int as c from users`
  console.log('user count:', JSON.stringify(userCount))

  const enums = await sql`
    select t.typname, e.enumlabel
    from pg_type t join pg_enum e on t.oid = e.enumtypid
    where t.typname in ('user_status','user_role')
    order by t.typname, e.enumsortorder
  `
  console.log('enums:', JSON.stringify(enums, null, 2))
}

main().then(() => process.exit(0)).catch((e) => { console.error('ERROR', e); process.exit(1) })
