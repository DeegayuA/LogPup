import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { bridgeEmailAllowed, bridgeKeyValid } from './bridge-auth'

describe('bridge-auth', () => {
  const originalKey = process.env.LOGPUP_EXTERNAL_API_KEY

  beforeEach(() => {
    process.env.LOGPUP_EXTERNAL_API_KEY = 'a-long-shared-secret'
  })
  afterEach(() => {
    process.env.LOGPUP_EXTERNAL_API_KEY = originalKey
  })

  // There is no domain gate any more: LogPup's Google sign-in is open to any verified account
  // behind admin approval, so a domain list refused people who use LogPup every day. Who may be
  // read is decided by resolveBridgeUser's canHoldWork() — this only rejects non-addresses.
  describe('bridgeEmailAllowed', () => {
    it('accepts any domain, including personal addresses', () => {
      expect(bridgeEmailAllowed('Someone@Altavision.LK')).toBe(true)
      expect(bridgeEmailAllowed('someone@gmail.com')).toBe(true)
      expect(bridgeEmailAllowed('someone@syntaxgenie.com')).toBe(true)
    })

    // A leftover LOGPUP_BRIDGE_DOMAINS on a server must not quietly bring the gate back.
    it('ignores a leftover LOGPUP_BRIDGE_DOMAINS', () => {
      const before = process.env.LOGPUP_BRIDGE_DOMAINS
      process.env.LOGPUP_BRIDGE_DOMAINS = 'altavision.lk'
      try {
        expect(bridgeEmailAllowed('someone@gmail.com')).toBe(true)
      } finally {
        if (before === undefined) delete process.env.LOGPUP_BRIDGE_DOMAINS
        else process.env.LOGPUP_BRIDGE_DOMAINS = before
      }
    })

    it('refuses things that are not an address', () => {
      expect(bridgeEmailAllowed('')).toBe(false)
      expect(bridgeEmailAllowed('   ')).toBe(false)
      expect(bridgeEmailAllowed('altavision.lk')).toBe(false)
      expect(bridgeEmailAllowed('@altavision.lk')).toBe(false)
      expect(bridgeEmailAllowed('someone@')).toBe(false)
      expect(bridgeEmailAllowed('some one@gmail.com')).toBe(false)
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
