import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { buildSnapshot, encryptSnapshot } from '@/features/admin/backup'

// Daily database backup. Invoked by Vercel Cron (see vercel.json). Vercel automatically
// sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set, which we require
// so the endpoint can't be triggered by anyone else.
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Constant-time comparison of the presented header against the expected secret.
// A plain `===` leaks timing information proportional to the matching prefix length,
// letting an attacker recover CRON_SECRET byte-by-byte. Hashing both sides first also
// normalizes their length, so timingSafeEqual (which requires equal-length buffers)
// never throws regardless of what the caller sends.
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const provided = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  const providedDigest = createHash('sha256').update(provided).digest()
  const expectedDigest = createHash('sha256').update(expected).digest()
  return timingSafeEqual(providedDigest, expectedDigest)
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const snapshot = await buildSnapshot()
    const encrypted = encryptSnapshot(snapshot)
    const stamp = snapshot.exportedAt.replace(/[:.]/g, '-')
    const { url, pathname } = await put(`backups/logpup-${stamp}.json.enc`, encrypted, {
      access: 'private',
      contentType: 'application/octet-stream',
      addRandomSuffix: false,
    })
    const counts = Object.fromEntries(
      Object.entries(snapshot.tables).map(([t, rows]) => [t, rows.length]),
    )
    return NextResponse.json({ ok: true, pathname, url, counts, exportedAt: snapshot.exportedAt })
  } catch (e) {
    console.error('[backup] failed:', e)
    return NextResponse.json({ error: 'Backup failed' }, { status: 500 })
  }
}
