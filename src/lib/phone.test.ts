import { describe, expect, it } from 'vitest'
import { normalizePhone, telHref } from './phone'

describe('normalizePhone', () => {
  it('accepts the shapes people type', () => {
    expect(normalizePhone('+94 71 234 5678')).toBe('+94 71 234 5678')
    expect(normalizePhone('071-234-5678')).toBe('071-234-5678')
    expect(normalizePhone('(071) 2345678')).toBe('(071) 2345678')
  })

  it('collapses runs of whitespace and trims', () => {
    expect(normalizePhone('  071   234  5678 ')).toBe('071 234 5678')
  })

  it('rejects blanks, letters and implausible digit counts', () => {
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone('   ')).toBeNull()
    expect(normalizePhone('call me')).toBeNull()
    expect(normalizePhone('12345')).toBeNull()
    expect(normalizePhone('1234567890123456')).toBeNull()
  })
})

describe('telHref', () => {
  it('strips formatting so the href is dialable', () => {
    expect(telHref('+94 71 234 5678')).toBe('tel:+94712345678')
    expect(telHref('(071) 234-5678')).toBe('tel:0712345678')
  })

  it('keeps a leading + only when one was typed', () => {
    expect(telHref('0712345678')).toBe('tel:0712345678')
  })
})
