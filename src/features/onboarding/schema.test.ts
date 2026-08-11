import { describe, expect, it } from 'vitest'
import { onboardingInput } from './schema'

describe('onboardingInput', () => {
  it('accepts a valid phone + organization', () => {
    const result = onboardingInput.safeParse({
      phone: '+94 71 234 5678',
      organization: 'Alta Vision',
    })
    expect(result.success).toBe(true)
  })

  it('trims the organization', () => {
    const result = onboardingInput.safeParse({
      phone: '+94 71 234 5678',
      organization: '  Alta Vision  ',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.organization).toBe('Alta Vision')
  })

  it('rejects a blank phone', () => {
    expect(onboardingInput.safeParse({ phone: '', organization: 'Acme' }).success).toBe(false)
  })

  it('rejects an implausible phone', () => {
    expect(
      onboardingInput.safeParse({ phone: 'call me maybe', organization: 'Acme' }).success,
    ).toBe(false)
  })

  it('rejects a blank organization', () => {
    expect(
      onboardingInput.safeParse({ phone: '+94 71 234 5678', organization: '' }).success,
    ).toBe(false)
  })

  it('rejects an organization over 30 characters', () => {
    expect(
      onboardingInput.safeParse({
        phone: '+94 71 234 5678',
        organization: 'x'.repeat(31),
      }).success,
    ).toBe(false)
  })

  it('rejects a missing organization field entirely', () => {
    expect(onboardingInput.safeParse({ phone: '+94 71 234 5678' }).success).toBe(false)
  })
})
