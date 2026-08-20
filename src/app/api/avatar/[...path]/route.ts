import { get } from '@vercel/blob'
import { auth } from '@/lib/auth'

/**
 * Streams an uploaded avatar out of the PRIVATE blob store.
 *
 * The store also holds encrypted database backups, so it can never be made
 * public; avatars therefore go through here instead of a direct blob URL.
 * Signed-in users only — an avatar is a photo of a colleague, not something to
 * leave world-readable behind an unguessable URL.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const session = await auth()
  if (!session?.user) return new Response('Unauthorized', { status: 401 })
  // Deactivated accounts hold a real session now (src/lib/auth.ts) and the
  // proxy's deactivation gate skips /api, so "signed in" is no longer the
  // question. Same fix as the .ics and keyframe routes.
  if (!session.user.active) return new Response('Unauthorized', { status: 401 })

  const { path } = await params
  const pathname = path.map(decodeURIComponent).join('/')
  // Only ever serve avatars, whatever the URL claims.
  if (!pathname.startsWith('avatars/') || pathname.includes('..')) {
    return new Response('Not found', { status: 404 })
  }

  let blob: Awaited<ReturnType<typeof get>>
  try {
    blob = await get(pathname, { access: 'private' })
  } catch {
    return new Response('Not found', { status: 404 })
  }
  if (!blob) return new Response('Not found', { status: 404 })

  return new Response(blob.stream, {
    headers: {
      'Content-Type': blob.headers?.get('content-type') ?? 'image/webp',
      // Each upload gets a fresh random pathname, so a cached copy is only
      // ever the image that pathname has always pointed at. Private: this is
      // per-user content behind auth, never a shared CDN cache.
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
