import { describe, expect, it, vi } from 'vitest'

// The proxy body is next-auth's wrapper; only the matcher is under test here,
// so auth() is reduced to "return the handler".
vi.mock('@/lib/auth', () => ({ auth: (handler: unknown) => handler }))

const { config } = await import('./proxy')

// The matcher is a path-to-regexp source whose only group is a plain JS
// regex, so anchoring it reads the same way Next does for these literal paths.
const guarded = (path: string) => new RegExp(`^${config.matcher[0]}$`).test(path)

describe('proxy matcher', () => {
  // Regression: /api/attachments sat behind the redirect, so a signed-out
  // upload got a 307 to the HTML sign-in page instead of the route's own 401
  // JSON — which the task dialog renders as an opaque failure.
  it('leaves the attachment routes to answer for themselves', () => {
    expect(guarded('/api/attachments')).toBe(false)
    expect(guarded('/api/attachments/33333333-3333-4333-8333-333333333333')).toBe(false)
  })

  it('still guards the app and the other APIs', () => {
    expect(guarded('/apps/atlas')).toBe(true)
    expect(guarded('/api/search')).toBe(true)
    expect(guarded('/api/meetings/x/ics')).toBe(false)
  })
})
