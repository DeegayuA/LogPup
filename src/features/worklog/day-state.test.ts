import { describe, expect, it } from 'vitest'

import {
  classifyDay,
  dayStateText,
  isHalfDay,
  loggedTone,
} from './day-state'

// 2026-08-17 Mon … 2026-08-23 Sun; 2026-08-22 is a Saturday.
const today = '2026-08-20'

describe('classifyDay priority', () => {
  it('holiday beats everything, including a logged percent', () => {
    expect(classifyDay({ iso: '2026-08-18', percent: 90, holiday: true, today })).toBe('holiday')
  })

  it('approved absence excuses an unlogged working day', () => {
    expect(classifyDay({ iso: '2026-08-18', absent: true, today })).toBe('absence')
  })

  it('Sunday is off, never owed', () => {
    expect(classifyDay({ iso: '2026-08-23', today: '2026-08-25' })).toBe('off')
  })

  it('a logged day is logged; an unlogged past working day is owed', () => {
    expect(classifyDay({ iso: '2026-08-18', percent: 40, today })).toBe('logged')
    expect(classifyDay({ iso: '2026-08-18', today })).toBe('owed')
  })

  it('future days are future, days before joining are outside', () => {
    expect(classifyDay({ iso: '2026-08-21', today })).toBe('future')
    expect(classifyDay({ iso: '2026-08-18', today, joinDay: '2026-08-19' })).toBe('outside')
  })

  it('today itself is owed when unlogged — the ask starts on the day', () => {
    expect(classifyDay({ iso: today, today })).toBe('owed')
  })
})

describe('half day', () => {
  it('Saturday is half; a Saturday holiday is not', () => {
    expect(isHalfDay('2026-08-22')).toBe(true)
    expect(isHalfDay('2026-08-22', true)).toBe(false)
    expect(isHalfDay('2026-08-19')).toBe(false)
  })
})

describe('loggedTone steps', () => {
  it('four steps, monotonic with percent', () => {
    expect(loggedTone(100)).toBe('bg-primary')
    expect(loggedTone(80)).toBe('bg-primary')
    expect(loggedTone(60)).toBe('bg-primary/75')
    expect(loggedTone(30)).toBe('bg-primary/55')
    expect(loggedTone(10)).toBe('bg-primary/35')
  })
})

describe('dayStateText', () => {
  it('names the state in words and appends percent only when logged', () => {
    expect(dayStateText({ iso: '2026-08-18', percent: 80, today })).toBe('18 — Logged, 80%')
    expect(dayStateText({ iso: '2026-08-18', holiday: true, today })).toBe('18 — Holiday')
    expect(dayStateText({ iso: '2026-08-22', today: '2026-08-25' })).toBe('22 — Not logged yet, half day')
  })
})
