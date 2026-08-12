import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PERSONAL_EMAIL_MAX_LENGTH } from '@/features/auth/personal-email-schema'

// users.personal_email is admin-only and contact-only. Two properties are
// worth pinning down, and neither is visible from the UI:
//   1. the requireAdmin() guard refuses AND never reaches the database;
//   2. the write only ever touches `personalEmail` — never `email`, which is
//      the sign-in identity. A regression that widened this action to the
//      login column would hand any admin a way to take over an account.
const { authMock, writeSpy } = vi.hoisted(() => ({
  authMock: vi.fn(),
  writeSpy: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/db', () => ({
  db: {
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          writeSpy(values)
        },
      }),
    }),
  },
}))

const { setUserPersonalEmail } = await import('./actions')

const TARGET_ID = '11111111-1111-4111-8111-111111111111'

const asAdmin = () => authMock.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } })
const asMember = () => authMock.mockResolvedValue({ user: { id: 'member-1', role: 'member' } })

beforeEach(() => {
  authMock.mockReset()
  writeSpy.mockReset()
})

describe('setUserPersonalEmail authorization', () => {
  it('rejects a signed-out caller and writes nothing', async () => {
    authMock.mockResolvedValue(null)
    const res = await setUserPersonalEmail(TARGET_ID, 'someone@gmail.com')
    expect(res).toEqual({ ok: false, error: 'Admins only' })
    expect(writeSpy).not.toHaveBeenCalled()
  })

  it('rejects a member calling the action directly and writes nothing', async () => {
    asMember()
    const res = await setUserPersonalEmail(TARGET_ID, 'someone@gmail.com')
    expect(res).toEqual({ ok: false, error: 'Admins only' })
    expect(writeSpy).not.toHaveBeenCalled()
  })

  it('fails closed on a session with no role at all', async () => {
    authMock.mockResolvedValue({ user: { id: 'ghost-1' } })
    const res = await setUserPersonalEmail(TARGET_ID, 'someone@gmail.com')
    expect(res).toEqual({ ok: false, error: 'Admins only' })
    expect(writeSpy).not.toHaveBeenCalled()
  })
})

describe('setUserPersonalEmail as an admin', () => {
  it('writes the trimmed, lowercased address', async () => {
    asAdmin()
    const res = await setUserPersonalEmail(TARGET_ID, '  Someone.Else@Gmail.com  ')
    expect(res).toEqual({ ok: true, data: undefined })
    expect(writeSpy).toHaveBeenCalledWith({ personalEmail: 'someone.else@gmail.com' })
  })

  it('never touches the sign-in email column', async () => {
    asAdmin()
    await setUserPersonalEmail(TARGET_ID, 'someone@gmail.com')
    expect(writeSpy).toHaveBeenCalledTimes(1)
    expect(Object.keys(writeSpy.mock.calls[0][0])).toEqual(['personalEmail'])
  })

  it('clears the address when given a blank string', async () => {
    asAdmin()
    const res = await setUserPersonalEmail(TARGET_ID, '   ')
    expect(res.ok).toBe(true)
    expect(writeSpy).toHaveBeenCalledWith({ personalEmail: null })
  })

  it('rejects something that is not an email without writing', async () => {
    asAdmin()
    const res = await setUserPersonalEmail(TARGET_ID, 'Susara Withanage')
    expect(res).toEqual({ ok: false, error: 'That does not look like an email address' })
    expect(writeSpy).not.toHaveBeenCalled()
  })

  it('rejects an over-length address without writing', async () => {
    asAdmin()
    const long = `${'a'.repeat(PERSONAL_EMAIL_MAX_LENGTH)}@gmail.com`
    const res = await setUserPersonalEmail(TARGET_ID, long)
    expect(res).toEqual({
      ok: false,
      error: `Personal email must be ${PERSONAL_EMAIL_MAX_LENGTH} characters or fewer`,
    })
    expect(writeSpy).not.toHaveBeenCalled()
  })

  it('accepts an address outside the sign-in domain allowlist', async () => {
    // The whole point of the column: gmail addresses that emailAllowed()
    // would refuse for `email` are fine here, because this one never logs in.
    asAdmin()
    const res = await setUserPersonalEmail(TARGET_ID, 'nobody@example.org')
    expect(res.ok).toBe(true)
    expect(writeSpy).toHaveBeenCalledWith({ personalEmail: 'nobody@example.org' })
  })

  it('rejects a non-string payload without writing', async () => {
    asAdmin()
    const res = await setUserPersonalEmail(TARGET_ID, { email: 'someone@gmail.com' })
    expect(res.ok).toBe(false)
    expect(writeSpy).not.toHaveBeenCalled()
  })

  it('rejects a malformed user id without writing', async () => {
    asAdmin()
    const res = await setUserPersonalEmail('../../etc/passwd', 'someone@gmail.com')
    expect(res).toEqual({ ok: false, error: 'Invalid user' })
    expect(writeSpy).not.toHaveBeenCalled()
  })
})
