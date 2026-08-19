import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)
console.table(await sql`select id, email, name, role from users order by role, email`)
