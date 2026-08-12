import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDeduper } from '@/lib/dedupe'

afterEach(() => {
  vi.useRealTimers()
})

/** A promise plus the handles to settle it, so a test controls "in flight". */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('createDeduper', () => {
  it('runs the work once while it is in flight, however many callers ask', async () => {
    const deduper = createDeduper<string>()
    const gate = deferred<string>()
    const fn = vi.fn(() => gate.promise)

    // Three "fast clicks" before anything comes back.
    const a = deduper.run('search:pup', fn)
    const b = deduper.run('search:pup', fn)
    const c = deduper.run('search:pup', fn)

    expect(fn).toHaveBeenCalledTimes(1)
    gate.resolve('one result')
    expect(await Promise.all([a, b, c])).toEqual(['one result', 'one result', 'one result'])
  })

  it('keeps different keys independent', async () => {
    const deduper = createDeduper<string>()
    const fn = vi.fn(async (value: string) => value)

    await Promise.all([deduper.run('a', () => fn('a')), deduper.run('b', () => fn('b'))])

    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('with the default zero TTL, a call after the result lands is a real re-fetch', async () => {
    const deduper = createDeduper<number>()
    let calls = 0
    const fn = async () => ++calls

    expect(await deduper.run('k', fn)).toBe(1)
    expect(await deduper.run('k', fn)).toBe(2)
    // Nothing retained: in-flight sharing only.
    expect(deduper.size).toBe(0)
  })

  it('serves a settled result inside ttlMs and re-fetches after it lapses', async () => {
    vi.useFakeTimers()
    const deduper = createDeduper<number>({ ttlMs: 1000 })
    let calls = 0
    const fn = async () => ++calls

    expect(await deduper.run('k', fn)).toBe(1)

    vi.advanceTimersByTime(999)
    expect(await deduper.run('k', fn)).toBe(1)
    expect(calls).toBe(1)

    vi.advanceTimersByTime(2)
    expect(await deduper.run('k', fn)).toBe(2)
  })

  it('never retains a rejection — the next call is a genuine retry', async () => {
    const deduper = createDeduper<string>({ ttlMs: 10_000 })
    let calls = 0
    const fn = async () => {
      calls++
      if (calls === 1) throw new Error('network down')
      return 'recovered'
    }

    await expect(deduper.run('k', fn)).rejects.toThrow('network down')
    // Same key, well inside the TTL: must retry rather than replay the failure.
    expect(await deduper.run('k', fn)).toBe('recovered')
    expect(calls).toBe(2)
  })

  it('shares one in-flight rejection with every joined caller', async () => {
    const deduper = createDeduper<string>()
    const gate = deferred<string>()
    const fn = vi.fn(() => gate.promise)

    const a = deduper.run('k', fn)
    const b = deduper.run('k', fn)
    gate.reject(new Error('boom'))

    await expect(a).rejects.toThrow('boom')
    await expect(b).rejects.toThrow('boom')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('invalidate forces the next call to re-run even mid-TTL', async () => {
    vi.useFakeTimers()
    const deduper = createDeduper<number>({ ttlMs: 10_000 })
    let calls = 0
    const fn = async () => ++calls

    expect(await deduper.run('k', fn)).toBe(1)
    deduper.invalidate('k')
    expect(await deduper.run('k', fn)).toBe(2)
  })

  it('evicts least-recently-used keys past `max` instead of growing forever', async () => {
    vi.useFakeTimers()
    const deduper = createDeduper<string>({ ttlMs: 10_000, max: 2 })

    await deduper.run('a', async () => 'a')
    await deduper.run('b', async () => 'b')
    // Touching 'a' makes 'b' the least-recently-used entry.
    await deduper.run('a', async () => 'a again')
    await deduper.run('c', async () => 'c')

    expect(deduper.size).toBe(2)

    // Probe 'a' first: a miss would itself insert and push the map back over
    // `max`, evicting whatever we were about to check next.
    let aCalls = 0
    await deduper.run('a', async () => {
      aCalls++
      return 'a refetched'
    })
    expect(aCalls).toBe(0) // 'a' survived — it was touched most recently

    let bCalls = 0
    await deduper.run('b', async () => {
      bCalls++
      return 'b refetched'
    })
    expect(bCalls).toBe(1) // 'b' was the one evicted
  })

  it('clear drops everything', async () => {
    vi.useFakeTimers()
    const deduper = createDeduper<string>({ ttlMs: 10_000 })
    await deduper.run('a', async () => 'a')
    await deduper.run('b', async () => 'b')
    expect(deduper.size).toBe(2)

    deduper.clear()
    expect(deduper.size).toBe(0)
  })
})
