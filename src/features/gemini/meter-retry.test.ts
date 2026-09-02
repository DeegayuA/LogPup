import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { KEY_FAILURE_CODE, canRetry, isKeyFailure } from './meter-tasks'

describe('canRetry', () => {
  it('offers a retry only for a failure', () => {
    expect(canRetry({ phase: 'failed' })).toBe(true)
  })

  it('refuses every phase that is not a failure', () => {
    // Running is not finished; settling is waiting on the ledger rather than
    // on the model; done succeeded. "Try again" on any of them invites a
    // second charge for work that either is not over or did not go wrong.
    expect(canRetry({ phase: 'running' })).toBe(false)
    expect(canRetry({ phase: 'settling' })).toBe(false)
    expect(canRetry({ phase: 'done' })).toBe(false)
  })
})

describe('isKeyFailure', () => {
  it('recognises a rejected or spent key', () => {
    expect(isKeyFailure({ errorCode: KEY_FAILURE_CODE })).toBe(true)
  })

  it('does not claim an unclassified failure is a key problem', () => {
    // Most actions never set a code. Sending somebody to check a key that is
    // working is worse than saying nothing.
    expect(isKeyFailure({ errorCode: null })).toBe(false)
  })

  it('does not fire for a different failure', () => {
    expect(isKeyFailure({ errorCode: 'MALFORMED_JSON' })).toBe(false)
  })
})

describe('KEY_FAILURE_CODE', () => {
  it('still matches the code client.ts actually throws', () => {
    // The literal is duplicated: client.ts is server-side and this module is
    // imported by the dock. Read rather than imported, so this test does not
    // pull a server module into the suite.
    //
    // This repo has already shipped ONE constant twice under one name with two
    // different values (FOLLOWUP_STALE_DAYS, 14 and 21). This test is what
    // keeps that from becoming two here: rename or re-code the auth failure in
    // client.ts and this goes red instead of the link quietly never appearing.
    const client = readFileSync('src/features/gemini/client.ts', 'utf8')
    expect(client).toContain(`new GeminiError(\n        '${KEY_FAILURE_CODE}'`)
  })
})
