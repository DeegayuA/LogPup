import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import { describe, it, expect } from 'vitest'

/**
 * public/sw.js is a classic service-worker script, not a module — it can't be
 * imported. Evaluate it in a vm with a stubbed `self` and hand back the two
 * predicates that decide what is allowed into Cache Storage.
 *
 * That allowlist is a security boundary: Cache Storage is scoped to the origin,
 * not the session, so anything cacheable here outlives sign-out and is readable
 * by the next person to use the browser profile.
 */
function loadServiceWorker() {
  const source = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8')
  const context: Record<string, unknown> = {
    self: {
      addEventListener: () => {},
      skipWaiting: () => {},
      clients: { claim: () => {} },
      location: { origin: 'https://logpup.test' },
    },
    caches: {
      keys: async () => [],
      delete: async () => true,
      open: async () => ({ put: async () => {} }),
      match: async () => undefined,
    },
    URL,
    Response,
    Headers,
    fetch: async () => new Response(''),
  }
  vm.createContext(context)
  return vm.runInContext(
    `${source}\n;({ isCacheableAsset, isStorable, CACHE })`,
    context,
  ) as {
    isCacheableAsset: (url: URL) => boolean
    isStorable: (response: Response) => boolean
    CACHE: string
  }
}

const { isCacheableAsset, isStorable, CACHE } = loadServiceWorker()

const url = (path: string) => new URL(path, 'https://logpup.test')

describe('service worker cache allowlist', () => {
  it('caches immutable build assets and icons', () => {
    expect(isCacheableAsset(url('/_next/static/chunks/main-abc123.js'))).toBe(true)
    expect(isCacheableAsset(url('/manifest.webmanifest'))).toBe(true)
    expect(isCacheableAsset(url('/pwa-icon'))).toBe(true)
    expect(isCacheableAsset(url('/apple-icon'))).toBe(true)
    expect(isCacheableAsset(url('/globe.svg'))).toBe(true)
  })

  it('never caches an authenticated page', () => {
    // The exact documents that leaked the whole user directory offline.
    expect(isCacheableAsset(url('/admin'))).toBe(false)
    expect(isCacheableAsset(url('/people'))).toBe(false)
    expect(isCacheableAsset(url('/meetings'))).toBe(false)
    expect(isCacheableAsset(url('/profile'))).toBe(false)
    expect(isCacheableAsset(url('/apps/acme-crm'))).toBe(false)
    expect(isCacheableAsset(url('/'))).toBe(false)
  })

  it('never caches RSC payloads, API responses or proxied user images', () => {
    // Client-side navigations fetch these — same content as the document.
    expect(isCacheableAsset(url('/admin?_rsc=1a2b3'))).toBe(false)
    expect(isCacheableAsset(url('/api/meetings'))).toBe(false)
    // /_next/image proxies user-uploaded avatars; only /_next/static is allowed.
    expect(isCacheableAsset(url('/_next/image?url=%2Favatar.png&w=64'))).toBe(false)
  })

  it('refuses to store a response the server marked uncacheable', () => {
    const withCacheControl = (value: string) =>
      new Response('', { headers: { 'Cache-Control': value } })

    // Next.js sets no-store on dynamic authenticated renders.
    expect(isStorable(withCacheControl('no-store'))).toBe(false)
    expect(isStorable(withCacheControl('private, max-age=0'))).toBe(false)
    expect(isStorable(withCacheControl('PRIVATE'))).toBe(false)
    expect(isStorable(withCacheControl('public, max-age=31536000, immutable'))).toBe(true)
    expect(isStorable(new Response(''))).toBe(true)
  })

  it('uses a cache name past the poisoned logpup-v1', () => {
    // `activate` deletes every cache that isn't CACHE, so bumping the name is
    // what evicts authenticated documents cached by the previous worker.
    expect(CACHE).not.toBe('logpup-v1')
  })
})
