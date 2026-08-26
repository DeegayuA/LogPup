import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The socket state machine had no tests, and the contract that matters most
 * lives at exactly this end: the resumption handle presented to the MINT must
 * be the one sent in the setup FRAME, and neither may be a handle the server
 * has disowned. live-protocol.test.ts asserts the two builders agree with each
 * other; only this file can assert the session feeds them the right handle.
 *
 * Audio is never started here — these cases deliberately never send
 * `setupComplete`, which is what would reach for an AudioContext.
 */

class FakeSocket {
  static instances: FakeSocket[] = []
  static readonly OPEN = 1
  static readonly CONNECTING = 0

  readyState = 1
  url: string
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: (() => void) | null = null
  sent: string[] = []

  constructor(url: string) {
    this.url = url
    FakeSocket.instances.push(this)
  }

  send(payload: string) {
    this.sent.push(payload)
  }

  close() {
    this.readyState = 3
  }

  /** Deliver one server frame, as the browser would. */
  deliver(frame: unknown) {
    this.onmessage?.({ data: JSON.stringify(frame) })
  }
}

vi.stubGlobal('WebSocket', FakeSocket)

const { LiveTranscriptionSession } = await import('./live-client')

/** Lets every pending microtask settle without advancing the clock. */
async function settle() {
  for (let i = 0; i < 8; i += 1) await Promise.resolve()
}

/**
 * Drives the session to its next connection attempt: closes the live socket,
 * then runs the jittered backoff timer out.
 */
async function reconnect() {
  const socket = FakeSocket.instances.at(-1)
  socket?.onclose?.()
  await settle()
  await vi.advanceTimersByTimeAsync(60_000)
  await settle()
}

/** The session's own mint contract — typed so a signature drift fails tsc. */
type TokenFn = (resumptionHandle: string | null) => Promise<{ token: string; model: string }>

let requestToken: ReturnType<typeof vi.fn<TokenFn>>

function newSession() {
  return new LiveTranscriptionSession({
    stream: {} as MediaStream,
    requestToken,
    maxReconnectAttempts: 10,
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  FakeSocket.instances = []
  requestToken = vi.fn<TokenFn>(async () => ({ token: 'tok', model: 'gemini-live-test' }))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('resumption handle presented to the mint', () => {
  it('presents null on the first connect', async () => {
    const session = newSession()
    await session.start()
    await settle()

    expect(requestToken).toHaveBeenCalledWith(null)
    session.stop()
  })

  it('presents a resumable handle on the next connect', async () => {
    const session = newSession()
    await session.start()
    await settle()

    FakeSocket.instances[0].deliver({
      sessionResumptionUpdate: { newHandle: 'handle-1', resumable: true },
    })
    await reconnect()

    expect(requestToken).toHaveBeenNthCalledWith(2, 'handle-1')
    session.stop()
  })

  it('sends the SAME handle in the setup frame that it pinned into the token', async () => {
    // The whole point of a constrained ephemeral token: the pinned setup and
    // the sent setup must correspond. A mismatch is refused server-side, and
    // nothing else in the suite covers this end of it.
    const session = newSession()
    await session.start()
    await settle()

    FakeSocket.instances[0].deliver({
      sessionResumptionUpdate: { newHandle: 'handle-1', resumable: true },
    })
    await reconnect()

    const socket = FakeSocket.instances[1]
    socket.onopen?.()
    const setup = JSON.parse(socket.sent[0]) as {
      setup: { sessionResumption: { handle?: string } }
    }
    expect(setup.setup.sessionResumption.handle).toBe('handle-1')
    expect(requestToken).toHaveBeenNthCalledWith(2, 'handle-1')
    session.stop()
  })

  it('drops a handle the server marked non-resumable', async () => {
    // `resumable` was parsed and typed but never read, so a handle the server
    // said it would NOT take back was stored, pinned into the next token, and
    // sent in the next setup frame.
    const session = newSession()
    await session.start()
    await settle()

    FakeSocket.instances[0].deliver({
      sessionResumptionUpdate: { newHandle: 'handle-1', resumable: true },
    })
    FakeSocket.instances[0].deliver({
      sessionResumptionUpdate: { newHandle: 'handle-2', resumable: false },
    })
    await reconnect()

    expect(requestToken).toHaveBeenNthCalledWith(2, null)
    session.stop()
  })

  it('stops re-presenting a handle after the first failed reconnect', async () => {
    // Nothing ever cleared the handle. A stale one was re-pinned on every
    // subsequent attempt for the rest of the meeting — and if the handle is
    // itself what the server rejects, the session can never recover, where a
    // fresh one would simply have connected.
    const session = newSession()
    await session.start()
    await settle()

    FakeSocket.instances[0].deliver({
      sessionResumptionUpdate: { newHandle: 'handle-1', resumable: true },
    })
    await reconnect()
    expect(requestToken).toHaveBeenNthCalledWith(2, 'handle-1')

    await reconnect()
    expect(requestToken).toHaveBeenNthCalledWith(3, null)

    await reconnect()
    expect(requestToken).toHaveBeenNthCalledWith(4, null)
    session.stop()
  })
})

describe('a token failure does not spend the meeting retrying', () => {
  it('falls straight through to the caller instead of the reconnect schedule', async () => {
    // The mint already walked every key and every model server-side. Four more
    // attempts out here is a minute of dead air before Web Speech may start.
    const onFailure = vi.fn()
    requestToken = vi.fn<TokenFn>(async () => {
      throw new Error('Your Gemini key was rejected')
    })
    const session = new LiveTranscriptionSession({
      stream: {} as MediaStream,
      requestToken,
      callbacks: { onFailure },
    })

    await session.start()
    await settle()

    expect(onFailure).toHaveBeenCalledWith('Your Gemini key was rejected')
    expect(requestToken).toHaveBeenCalledTimes(1)
    expect(session.status).toBe('failed')
  })
})
