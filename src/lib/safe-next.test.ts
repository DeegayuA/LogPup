import { describe, it, expect } from 'vitest'
import { safeNext } from './safe-next'

describe('safeNext', () => {
  it('passes an ordinary relative path through unchanged', () => {
    expect(safeNext('/apps/logpup')).toBe('/apps/logpup')
    expect(safeNext('/tasks?board=3#row-9')).toBe('/tasks?board=3#row-9')
    expect(safeNext('/')).toBe('/')
  })

  it('refuses a protocol-relative URL', () => {
    // The whole reason this helper exists: it looks like a path and is not.
    expect(safeNext('//evil.example')).toBe('/')
    expect(safeNext('//evil.example/apps/logpup')).toBe('/')
  })

  it('refuses a backslash, which browsers normalise to a second slash', () => {
    expect(safeNext('/\\evil.example')).toBe('/')
    expect(safeNext('/\\/evil.example')).toBe('/')
  })

  it('refuses anything absolute', () => {
    expect(safeNext('https://evil.example')).toBe('/')
    expect(safeNext('http://evil.example')).toBe('/')
    expect(safeNext('javascript:alert(1)')).toBe('/')
    expect(safeNext('evil.example')).toBe('/')
  })

  it('refuses a non-string, including the missing case', () => {
    expect(safeNext(undefined)).toBe('/')
    expect(safeNext(null)).toBe('/')
    expect(safeNext('')).toBe('/')
    expect(safeNext(42)).toBe('/')
    expect(safeNext(['/tasks'])).toBe('/')
  })

  it('takes a caller-supplied fallback', () => {
    expect(safeNext('//evil.example', '/tasks')).toBe('/tasks')
  })
})
