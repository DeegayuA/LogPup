import { describe, expect, it } from 'vitest'
import {
  CHAT_MAX_BYTES,
  CHAT_MAX_TURNS,
  appendTurn,
  capBytes,
  parseChat,
  serializedBytes,
  type ChatTurn,
} from './chat-history'

function turn(n: number, answer = `answer ${n}`): ChatTurn {
  return {
    id: `t${n}`,
    question: `question ${n}`,
    answer,
    citations: [{ label: 'Pasindu', href: '/people/abc' }],
    grounded: true,
    model: 'gemini-3.6-flash',
    askedAt: 1_787_000_000_000 + n,
  }
}

describe('appendTurn', () => {
  it('puts the newest first, which is the order the panel reads', () => {
    const out = appendTurn([turn(1)], turn(2))
    expect(out.map((t) => t.id)).toEqual(['t2', 't1'])
  })

  it('drops the oldest past the turn cap', () => {
    let chat: ChatTurn[] = []
    for (let i = 1; i <= CHAT_MAX_TURNS + 5; i++) chat = appendTurn(chat, turn(i))
    expect(chat).toHaveLength(CHAT_MAX_TURNS)
    expect(chat[0].id).toBe(`t${CHAT_MAX_TURNS + 5}`)
    expect(chat.some((t) => t.id === 't1')).toBe(false)
  })
})

describe('capBytes', () => {
  it('evicts from the oldest end until the stored form fits', () => {
    // The cap that actually protects the origin's quota: a turn count says
    // nothing about size, and answers are model-generated prose.
    const fat = 'x'.repeat(40_000)
    const chat = [turn(3, fat), turn(2, fat), turn(1, fat), turn(0, fat)]
    const out = capBytes(chat)
    expect(serializedBytes(out)).toBeLessThanOrEqual(CHAT_MAX_BYTES)
    expect(out[0].id).toBe('t3')
    expect(out.length).toBeLessThan(chat.length)
  })

  it('keeps one turn even when that turn alone is over the cap', () => {
    // Returning [] here would read to the person as "it did not save my
    // question", which is worse than one oversized entry.
    const huge = [turn(1, 'y'.repeat(CHAT_MAX_BYTES * 2))]
    expect(capBytes(huge)).toHaveLength(1)
  })

  it('leaves a small transcript untouched', () => {
    const chat = [turn(2), turn(1)]
    expect(capBytes(chat)).toEqual(chat)
  })
})

describe('parseChat', () => {
  it('round-trips what appendTurn wrote', () => {
    const chat = appendTurn([turn(1)], turn(2))
    expect(parseChat(JSON.stringify(chat))).toEqual(chat)
  })

  it('treats corrupt storage as an empty transcript, never a crash', () => {
    expect(parseChat('{not json')).toEqual([])
    expect(parseChat('')).toEqual([])
    expect(parseChat('"a string"')).toEqual([])
    expect(parseChat('null')).toEqual([])
  })

  it('drops only the bad rows, keeping the good ones', () => {
    // One half-written entry must not take the rest of somebody's transcript
    // with it.
    const mixed = JSON.stringify([turn(2), { id: 'x', question: 'no answer field' }, turn(1)])
    expect(parseChat(mixed).map((t) => t.id)).toEqual(['t2', 't1'])
  })

  it('rejects a turn whose citations are the wrong shape', () => {
    const bad = JSON.stringify([{ ...turn(1), citations: [{ label: 'no href' }] }])
    expect(parseChat(bad)).toEqual([])
  })
})
