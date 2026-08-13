import { describe, it, expect } from 'vitest'
import { appCreateInput } from './create-input'

const VALID_UUID = '11111111-1111-4111-8111-111111111111'

describe('appCreateInput', () => {
  it('rejects a payload with no PM', () => {
    const result = appCreateInput.safeParse({ name: 'Test App' })
    expect(result.success).toBe(false)
  })

  it('rejects an explicitly empty PM', () => {
    const result = appCreateInput.safeParse({ name: 'Test App', pmId: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a PM that is not a uuid', () => {
    const result = appCreateInput.safeParse({ name: 'Test App', pmId: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('accepts a payload with a valid PM', () => {
    const result = appCreateInput.safeParse({ name: 'Test App', pmId: VALID_UUID })
    expect(result.success).toBe(true)
  })

  it('still requires a name even when the PM is present', () => {
    const result = appCreateInput.safeParse({ pmId: VALID_UUID })
    expect(result.success).toBe(false)
  })

  it('leaves lead optional, unlike PM', () => {
    const result = appCreateInput.safeParse({ name: 'Test App', pmId: VALID_UUID })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.leadId).toBeUndefined()
    }
  })
})
