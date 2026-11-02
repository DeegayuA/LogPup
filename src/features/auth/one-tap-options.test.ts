import { describe, expect, it } from 'vitest'
import { ONE_TAP_OPTIONS } from './one-tap-options'

describe('ONE_TAP_OPTIONS', () => {
  it('does not abort the pending FedCM request on a page click', () => {
    // Regression: with tap-outside on, clicking "Continue with Google" aborted
    // the One Tap request and GSI logged "FedCM get() rejects with AbortError".
    expect(ONE_TAP_OPTIONS.cancel_on_tap_outside).toBe(false)
  })

  it('uses FedCM and never auto-selects an account', () => {
    expect(ONE_TAP_OPTIONS.use_fedcm_for_prompt).toBe(true)
    expect(ONE_TAP_OPTIONS.auto_select).toBe(false)
    expect(ONE_TAP_OPTIONS.context).toBe('signin')
  })
})
