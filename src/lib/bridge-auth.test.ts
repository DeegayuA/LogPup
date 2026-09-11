import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { bridgeDomains, bridgeEmailAllowed, bridgeKeyValid } from './bridge-auth'

describe('bridge-auth', () => {
  const originalDomains = process.env.LOGPUP_BRIDGE_DOMAINS
  const originalKey = process.env.LOGPUP_EXTERNAL_API_KEY

  beforeEach(() => {
    process.env.LOGPUP_BRIDGE_DOMAINS = 'altavision.lk'
    process.env.LOGPUP_EXTERNAL_API_KEY = 'a-long-shared-secret'
  })
  afterEach(() => {
    process.env.LOGPUP_BRIDGE_DOMAINS = originalDomains
    process.env.LOGPUP_EXTERNAL_API_KEY = originalKey
  })

  describe('bridgeDomains', () => {
    it('parses a comma list into trimmed lowercase domains, @ stripped', () => {
      process.env.LOGPUP_BRIDGE_DOMAINS = ' @Altavision.LK , example.com '
      expect(bridgeDomains()).toEqual(['altavision.lk', 'example.com'])
    })

    it('defaults to altavision.lk when unset', () => {
      delete process.env.LOGPUP_BRIDGE_DOMAINS
      expect(bridgeDomains()).toEqual(['altavision.lk'])
    })

    // The whole point of a SEPARATE variable: ALLOWED_EMAIL_DOMAINS decides who may sign in
    // and carries four domains. Widening sign-in must never widen what a shared API key reads.
    it('is independent of ALLOWED_EMAIL_DOMAINS', () => {
      process.env.ALLOWED_EMAIL_DOMAINS = 'altavision.lk,syntaxgenie.com,pearlcluster.lk'
      process.env.LOGPUP_BRIDGE_DOMAINS = 'altavision.lk'
      expect(bridgeEmailAllowed('someone@syntaxgenie.com')).toBe(false)
      expect(bridgeEmailAllowed('someone@altavision.lk')).toBe(true)
    })
  })

  describe('bridgeEmailAllowed', () => {
    it('accepts a configured domain, case-insensitively', () => {
      expect(bridgeEmailAllowed('Someone@Altavision.LK')).toBe(true)
    })

    it('refuses every other domain', () => {
      expect(bridgeEmailAllowed('someone@carecode.org')).toBe(false)
      expect(bridgeEmailAllowed('someone@gmail.com')).toBe(false)
    })

    it('refuses malformed addresses rather than guessing', () => {
      expect(bridgeEmailAllowed('')).toBe(false)
      expect(bridgeEmailAllowed('altavision.lk')).toBe(false)
      expect(bridgeEmailAllowed('@altavision.lk')).toBe(true) // has a domain, empty local part
      expect(bridgeEmailAllowed('a@b@altavision.lk')).toBe(true) // last @ wins, as elsewhere
    })

    // A subdomain is a different domain. "evil.altavision.lk.attacker.com" must not pass by
    // ending with the allowed string.
    it('matches the whole domain, never a suffix', () => {
      expect(bridgeEmailAllowed('someone@altavision.lk.attacker.com')).toBe(false)
      expect(bridgeEmailAllowed('someone@notaltavision.lk')).toBe(false)
      expect(bridgeEmailAllowed('someone@mail.altavision.lk')).toBe(false)
    })
  })

  describe('bridgeKeyValid', () => {
    it('accepts the configured key', () => {
      expect(bridgeKeyValid('a-long-shared-secret')).toBe(true)
    })

    it('refuses a wrong key, including a prefix of the right one', () => {
      expect(bridgeKeyValid('a-long-shared-secre')).toBe(false)
      expect(bridgeKeyValid('a-long-shared-secretX')).toBe(false)
      expect(bridgeKeyValid('wrong')).toBe(false)
    })

    // An unconfigured deployment must fail CLOSED. An empty expected secret matching an empty
    // header would make the endpoint public the moment somebody forgot the variable.
    it('fails closed when the key is not configured', () => {
      delete process.env.LOGPUP_EXTERNAL_API_KEY
      expect(bridgeKeyValid('anything')).toBe(false)
      expect(bridgeKeyValid('')).toBe(false)
      expect(bridgeKeyValid(null)).toBe(false)
    })

    it('refuses an absent header', () => {
      expect(bridgeKeyValid(null)).toBe(false)
      expect(bridgeKeyValid('')).toBe(false)
    })
  })
})
