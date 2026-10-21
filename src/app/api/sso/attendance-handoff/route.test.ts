import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const { authMock, resolveMock, signMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  resolveMock: vi.fn(),
  signMock: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/bridge-auth', () => ({ resolveBridgeUser: resolveMock }))
vi.mock('@/features/auth/attendance-sso', () => ({ signAttendanceHandoff: signMock }))

const { POST } = await import('./route')

function req(): NextRequest {
  return new Request('http://localhost/api/sso/attendance-handoff', {
    method: 'POST',
    body: JSON.stringify({ next: '/tasks' }),
  }) as unknown as NextRequest
}

describe('POST /api/sso/attendance-handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signMock.mockReturnValue('signed-token')
  })

  it('refuses without a session', async () => {
    authMock.mockResolvedValue(null)
    expect((await POST(req())).status).toBe(401)
  })

  // /api is exempt from proxy.ts's pending and deactivated gates, and there is no domain gate any
  // more — so this check is the only thing between an unapproved Google signup and a token.
  it('refuses an account resolveBridgeUser does not return (pending, deactivated, removed)', async () => {
    authMock.mockResolvedValue({ user: { email: 'Stranger@Gmail.com', name: 'S' } })
    resolveMock.mockResolvedValue(null)
    const res = await POST(req())
    expect(res.status).toBe(403)
    expect(resolveMock).toHaveBeenCalledWith('stranger@gmail.com')
    expect(signMock).not.toHaveBeenCalled()
  })

  it('mints for an approved account on any domain', async () => {
    authMock.mockResolvedValue({ user: { email: 'someone@gmail.com', name: 'Someone' } })
    resolveMock.mockResolvedValue({ id: 'u1', email: 'someone@gmail.com', name: 'Someone' })
    const res = await POST(req())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.url).toContain('token=signed-token')
    expect(signMock).toHaveBeenCalledWith('someone@gmail.com', 'Someone')
  })
})
