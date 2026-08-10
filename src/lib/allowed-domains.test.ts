import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { emailAllowed, allowedDomains } from './allowed-domains'

describe('allowed-domains', () => {
  const original = process.env.ALLOWED_EMAIL_DOMAINS
  const originalLegacy = process.env.ALLOWED_EMAIL_DOMAIN

  beforeEach(() => {
    process.env.ALLOWED_EMAIL_DOMAINS = 'altavision.lk,syntaxgenie.com,pearlcluster.lk,altavision.co.uk'
    delete process.env.ALLOWED_EMAIL_DOMAIN
  })
  afterEach(() => {
    process.env.ALLOWED_EMAIL_DOMAINS = original
    process.env.ALLOWED_EMAIL_DOMAIN = originalLegacy
  })

  it('parses the comma list into trimmed lowercase domains', () => {
    expect(allowedDomains()).toEqual([
      'altavision.lk', 'syntaxgenie.com', 'pearlcluster.lk', 'altavision.co.uk',
    ])
  })

  it('accepts every configured domain, case-insensitively', () => {
    expect(emailAllowed('a@altavision.lk')).toBe(true)
    expect(emailAllowed('b@syntaxgenie.com')).toBe(true)
    expect(emailAllowed('c@pearlcluster.lk')).toBe(true)
    expect(emailAllowed('D@Altavision.CO.UK')).toBe(true)
  })

  it('rejects other domains and lookalikes', () => {
    expect(emailAllowed('x@gmail.com')).toBe(false)
    expect(emailAllowed('x@altavision.lk.evil.com')).toBe(false)
    expect(emailAllowed('x@notaltavision.lk')).toBe(false)
    expect(emailAllowed('no-at-sign')).toBe(false)
    expect(emailAllowed('')).toBe(false)
  })

  it('falls back to the legacy single-domain var', () => {
    delete process.env.ALLOWED_EMAIL_DOMAINS
    process.env.ALLOWED_EMAIL_DOMAIN = 'altavision.lk'
    expect(emailAllowed('a@altavision.lk')).toBe(true)
    expect(emailAllowed('a@syntaxgenie.com')).toBe(false)
  })
})
