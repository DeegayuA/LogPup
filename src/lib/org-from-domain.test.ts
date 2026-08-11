import { describe, it, expect } from 'vitest'
import { orgForEmail } from './org-from-domain'

describe('org-from-domain', () => {
  it('maps known domains to their organization name', () => {
    expect(orgForEmail('a@altavision.lk')).toBe('Alta Vision')
    expect(orgForEmail('a@altavision.co.uk')).toBe('Alta Vision UK')
    expect(orgForEmail('a@syntaxgenie.com')).toBe('Syntax Genie')
    expect(orgForEmail('a@pearlcluster.lk')).toBe('Pearl Cluster')
    expect(orgForEmail('a@gmail.com')).toBe('Personal')
  })

  it('is case-insensitive on the domain', () => {
    expect(orgForEmail('A@AltaVision.LK')).toBe('Alta Vision')
    expect(orgForEmail('a@Gmail.COM')).toBe('Personal')
  })

  it('returns undefined for unknown domains or malformed input', () => {
    expect(orgForEmail('a@unknown.example')).toBeUndefined()
    expect(orgForEmail('no-at-sign')).toBeUndefined()
    expect(orgForEmail('')).toBeUndefined()
  })
})
