import { beforeEach, describe, expect, it, vi } from 'vitest'

const { authMock, redirectMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  // next/navigation's redirect throws to unwind the render; mirror that so code after it never runs.
  redirectMock: vi.fn((to: string) => {
    throw new Error(`REDIRECT:${to}`)
  }),
}))
vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('next/navigation', () => ({ redirect: redirectMock }))
vi.mock('@/features/auth/components/attendance-sso-receiver', () => ({
  AttendanceSsoReceiver: () => null,
}))

const { default: AttendanceSsoPage } = await import('./page')

const visit = (searchParams: Record<string, string>) =>
  AttendanceSsoPage({ searchParams: Promise.resolve(searchParams) })

describe('/sso/attendance', () => {
  beforeEach(() => vi.clearAllMocks())

  // Someone already signed in to LogPup must land where they were going, not on /sign-in because
  // the token was refused, expired or already spent. The sign-in page does not bounce a signed-in
  // visitor, so a failed redemption used to strand them there.
  it('sends an already-signed-in person straight to next, without redeeming', async () => {
    authMock.mockResolvedValue({ user: { email: 'someone@gmail.com' } })
    await expect(visit({ token: 't', next: '/tasks' })).rejects.toThrow('REDIRECT:/tasks')
  })

  it('renders the receiver for a signed-out person with a token', async () => {
    authMock.mockResolvedValue(null)
    await expect(visit({ token: 't', next: '/tasks' })).resolves.toBeTruthy()
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('sends a signed-out person without a token to /sign-in', async () => {
    authMock.mockResolvedValue(null)
    await expect(visit({})).rejects.toThrow('REDIRECT:/sign-in')
  })
})
