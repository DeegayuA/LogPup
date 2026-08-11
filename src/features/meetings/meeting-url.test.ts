import { describe, expect, it } from 'vitest'
import { isValidMeetingUrl, meetingUrlSchema } from './meeting-url'

/** Convenience: the parsed value, or the string 'REJECTED'. */
function parse(input: string): string | null | 'REJECTED' {
  const result = meetingUrlSchema.safeParse(input)
  return result.success ? result.data : 'REJECTED'
}

describe('meetingUrlSchema', () => {
  it('accepts the http(s) links people actually paste', () => {
    expect(parse('https://meet.google.com/abc-defg-hij')).toBe('https://meet.google.com/abc-defg-hij')
    expect(parse('https://zoom.us/j/9876543210?pwd=xyz')).toBe('https://zoom.us/j/9876543210?pwd=xyz')
    expect(parse('http://meet.example.com:8443/room')).toBe('http://meet.example.com:8443/room')
  })

  it('rejects schemes that execute when the Join link is clicked', () => {
    // These are all well-formed URLs — `new URL()` and a bare `z.url()` accept
    // every one of them. Pinning the protocol is the whole point.
    expect(parse('javascript:alert(document.cookie)')).toBe('REJECTED')
    expect(parse('JavaScript:alert(1)')).toBe('REJECTED')
    expect(parse('data:text/html,<script>alert(1)</script>')).toBe('REJECTED')
    expect(parse('vbscript:msgbox(1)')).toBe('REJECTED')
    expect(parse('file:///etc/passwd')).toBe('REJECTED')
  })

  it('rejects anything that is not an absolute link', () => {
    expect(parse('meet.google.com/abc')).toBe('REJECTED')
    expect(parse('//evil.example.com')).toBe('REJECTED')
    expect(parse('https://')).toBe('REJECTED')
    expect(parse('not a url')).toBe('REJECTED')
  })

  it('trims surrounding whitespace off a pasted link', () => {
    expect(parse('  https://meet.google.com/abc  ')).toBe('https://meet.google.com/abc')
  })

  it('treats a blank field as null so clearing it clears the column', () => {
    // '' must not survive as an empty string — a stored '' would render an
    // empty Join button and read as "there is a link" everywhere downstream.
    expect(parse('')).toBeNull()
    expect(parse('   ')).toBeNull()
  })
})

describe('isValidMeetingUrl', () => {
  it('agrees with the schema, and counts blank as valid because the link is optional', () => {
    expect(isValidMeetingUrl('')).toBe(true)
    expect(isValidMeetingUrl('https://meet.google.com/abc')).toBe(true)
    expect(isValidMeetingUrl('javascript:alert(1)')).toBe(false)
    expect(isValidMeetingUrl('meet.google.com')).toBe(false)
  })
})
