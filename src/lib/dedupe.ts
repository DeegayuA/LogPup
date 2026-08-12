/**
 * CLIENT-SIDE REQUEST DEDUPLICATION.
 *
 * The server has React `cache` for this (see lib/session.ts) — the browser has
 * nothing, so the same request goes out twice whenever two things ask for it at
 * once: a double click before the first response lands, a component that
 * mounts twice under StrictMode, a viewport prefetch racing the click it was
 * meant to make instant, or a search box that gets back to a query the user
 * already typed.
 *
 * meetings/components/meeting-intel.tsx solved exactly this inline with an
 * `inFlightRef` — one shared promise so the prefetch and the click that follows
 * it a few hundred milliseconds later become one `getMeetingIntel` instead of
 * two. This is that idea as a reusable, testable module, plus a short
 * settled-result window so a repeat within `ttlMs` is answered from memory
 * rather than from the network.
 *
 * Deliberately NOT a cache in the stale-data sense: `ttlMs` defaults to zero
 * (in-flight sharing only), and rejections are never retained — a failure must
 * be retryable on the very next call, not sticky for a window the caller did
 * not ask for.
 */

type Entry<T> = {
  promise: Promise<T>
  /** `null` while in flight; the settle timestamp once resolved. */
  settledAt: number | null
}

export type Deduper<T> = {
  /**
   * Run `fn` for `key`, or join the call already running (or the one that just
   * finished, within `ttlMs`) instead of starting a second one.
   */
  run: (key: string, fn: () => Promise<T>) => Promise<T>
  /** Forget `key` — use after a write that invalidates it. */
  invalidate: (key: string) => void
  /** Forget everything, e.g. when a dialog closes. */
  clear: () => void
  /** Entry count. Exposed for tests and for asserting the LRU bound holds. */
  readonly size: number
}

export type DeduperOptions = {
  /**
   * How long a *resolved* result keeps answering repeat calls, in ms.
   * 0 (the default) means in-flight sharing only.
   */
  ttlMs?: number
  /**
   * Hard bound on retained keys, oldest evicted first. A search box types its
   * way through hundreds of distinct queries in a long session; without this
   * the map would only ever grow.
   */
  max?: number
}

export function createDeduper<T>({ ttlMs = 0, max = 50 }: DeduperOptions = {}): Deduper<T> {
  // Insertion-ordered, which is what makes the eviction below a real LRU:
  // `run` re-inserts on every hit, so the first key Map iteration yields is
  // always the least recently used one.
  const entries = new Map<string, Entry<T>>()

  function evictIfNeeded() {
    while (entries.size > max) {
      const oldest = entries.keys().next()
      if (oldest.done) return
      entries.delete(oldest.value)
    }
  }

  return {
    run(key, fn) {
      const existing = entries.get(key)
      if (existing) {
        const fresh = existing.settledAt === null || Date.now() - existing.settledAt < ttlMs
        if (fresh) {
          // Re-insert so this key counts as most-recently-used.
          entries.delete(key)
          entries.set(key, existing)
          return existing.promise
        }
        entries.delete(key)
      }

      const entry: Entry<T> = { promise: null as unknown as Promise<T>, settledAt: null }
      entry.promise = fn().then(
        (value) => {
          entry.settledAt = Date.now()
          // A zero TTL means the result was only ever worth sharing while it
          // was in flight; drop it the moment it lands so the next caller
          // gets a genuinely fresh read.
          if (ttlMs <= 0 && entries.get(key) === entry) entries.delete(key)
          return value
        },
        (error) => {
          // Never retain a failure: the next call must be a real retry.
          if (entries.get(key) === entry) entries.delete(key)
          throw error
        },
      )
      entries.set(key, entry)
      evictIfNeeded()
      return entry.promise
    },

    invalidate(key) {
      entries.delete(key)
    },

    clear() {
      entries.clear()
    },

    get size() {
      return entries.size
    },
  }
}
