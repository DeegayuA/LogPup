import { describe, expect, it } from 'vitest'
import {
  MAX_ATTACHMENT_BYTES,
  attachmentHref,
  attachmentKind,
  checkAttachmentMeta,
  contentDisposition,
  extensionOf,
  formatBytes,
  isInlineMime,
  isUuid,
  sanitizeFileName,
  sniffMatches,
} from './attachments'

const bytes = (...values: number[]) => new Uint8Array(values)
const text = (s: string) => new TextEncoder().encode(s)

const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0)
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0)
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04, 0x14)
const PDF = text('%PDF-1.7\n')
const WEBP = new Uint8Array([...text('RIFF'), 0, 0, 0, 0, ...text('WEBPVP8 ')])

describe('checkAttachmentMeta', () => {
  it('accepts an allowlisted file and returns OUR canonical mime', () => {
    expect(checkAttachmentMeta({ name: 'shot.PNG', type: 'image/png', size: 10 })).toEqual({
      ok: true,
      ext: 'png',
      mime: 'image/png',
      kind: 'image',
    })
    // Windows reports .csv as Excel; stored type is still text/csv.
    const csv = checkAttachmentMeta({ name: 'a.csv', type: 'application/vnd.ms-excel', size: 10 })
    expect(csv.ok && csv.mime).toBe('text/csv')
    // Browsers commonly send no type for .md.
    expect(checkAttachmentMeta({ name: 'notes.md', type: '', size: 10 }).ok).toBe(true)
    expect(checkAttachmentMeta({ name: 'a.txt', type: 'text/plain; charset=utf-8', size: 1 }).ok).toBe(true)
  })

  it.each([
    ['logo.svg', 'image/svg+xml'],
    ['page.html', 'text/html'],
    ['page.htm', 'text/html'],
    ['run.exe', 'application/octet-stream'],
    ['noext', 'text/plain'],
  ])('refuses %s', (name, type) => {
    const result = checkAttachmentMeta({ name, type, size: 10 })
    expect(result.ok).toBe(false)
    expect(!result.ok && result.status).toBe(415)
  })

  it('refuses an extension/declared-type mismatch (svg renamed to png)', () => {
    const result = checkAttachmentMeta({ name: 'logo.png', type: 'image/svg+xml', size: 10 })
    expect(result.ok).toBe(false)
    expect(checkAttachmentMeta({ name: 'x.pdf', type: 'text/html', size: 10 }).ok).toBe(false)
    // An empty type is only tolerated for the text formats that need it.
    expect(checkAttachmentMeta({ name: 'x.png', type: '', size: 10 }).ok).toBe(false)
  })

  it('enforces size bounds', () => {
    expect(checkAttachmentMeta({ name: 'a.pdf', type: 'application/pdf', size: 0 })).toMatchObject({ ok: false, status: 400 })
    expect(checkAttachmentMeta({ name: 'a.pdf', type: 'application/pdf', size: MAX_ATTACHMENT_BYTES }).ok).toBe(true)
    expect(checkAttachmentMeta({ name: 'a.pdf', type: 'application/pdf', size: MAX_ATTACHMENT_BYTES + 1 })).toMatchObject({
      ok: false,
      status: 413,
    })
  })
})

describe('sniffMatches', () => {
  it('recognises each binary format by its magic bytes', () => {
    expect(sniffMatches('png', PNG)).toBe(true)
    expect(sniffMatches('jpg', JPEG)).toBe(true)
    expect(sniffMatches('jpeg', JPEG)).toBe(true)
    expect(sniffMatches('gif', text('GIF89a...'))).toBe(true)
    expect(sniffMatches('webp', WEBP)).toBe(true)
    expect(sniffMatches('pdf', PDF)).toBe(true)
    expect(sniffMatches('zip', ZIP)).toBe(true)
    expect(sniffMatches('docx', ZIP)).toBe(true)
    expect(sniffMatches('xlsx', bytes(0x50, 0x4b, 0x05, 0x06))).toBe(true)
  })

  it('refuses a file whose bytes are not what its extension claims', () => {
    expect(sniffMatches('png', JPEG)).toBe(false)
    expect(sniffMatches('png', text('<svg onload=alert(1)>'))).toBe(false)
    expect(sniffMatches('pdf', text('<html>'))).toBe(false)
    expect(sniffMatches('docx', PDF)).toBe(false)
    expect(sniffMatches('webp', text('RIFF\0\0\0\0WAVE'))).toBe(false)
    expect(sniffMatches('png', bytes(0x89, 0x50))).toBe(false) // truncated
    expect(sniffMatches('svg', text('<svg/>'))).toBe(false) // not allowlisted at all
  })

  it('accepts plain text but refuses binaries and markup renamed to text', () => {
    expect(sniffMatches('txt', text('hello\nworld'))).toBe(true)
    expect(sniffMatches('md', text('\uFEFF# Title'))).toBe(true)
    expect(sniffMatches('csv', text('a,b\n1,2'))).toBe(true)
    expect(sniffMatches('txt', PNG)).toBe(false)
    expect(sniffMatches('txt', text('  <!DOCTYPE html><script>'))).toBe(false)
    expect(sniffMatches('md', text('<svg xmlns="http://www.w3.org/2000/svg">'))).toBe(false)
  })
})

describe('sanitizeFileName', () => {
  it('drops directories, control and bidi characters', () => {
    expect(sanitizeFileName('C:\\Users\\me\\report.pdf')).toBe('report.pdf')
    expect(sanitizeFileName('../../etc/passwd')).toBe('passwd')
    expect(sanitizeFileName('invoice\u202Efdp.exe')).toBe('invoicefdp.exe')
    expect(sanitizeFileName('a\r\nb.txt')).toBe('ab.txt')
  })

  it('replaces reserved characters and trims dots and spaces', () => {
    expect(sanitizeFileName('a"b<c>.txt')).toBe('a_b_c_.txt')
    expect(sanitizeFileName('  ..hidden.txt. ')).toBe('hidden.txt')
    expect(sanitizeFileName('a   b.txt')).toBe('a b.txt')
  })

  it('caps length but keeps the extension', () => {
    const out = sanitizeFileName(`${'x'.repeat(300)}.pdf`)
    expect(out.length).toBe(120)
    expect(out.endsWith('.pdf')).toBe(true)
  })

  it('never returns an empty name', () => {
    expect(sanitizeFileName('')).toBe('file')
    expect(sanitizeFileName('...')).toBe('file')
  })
})

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [1023, '1023 B'],
    [1536, '1.5 KB'],
    [10 * 1024 * 1024, '10 MB'],
    [3.25 * 1024 * 1024, '3.3 MB'],
    [-1, '—'],
  ])('%d → %s', (input, expected) => {
    expect(formatBytes(input)).toBe(expected)
  })
})

describe('contentDisposition', () => {
  it('serves images and pdf inline, everything else as attachment', () => {
    expect(contentDisposition('a.png', 'image/png').startsWith('inline;')).toBe(true)
    expect(contentDisposition('a.pdf', 'application/pdf').startsWith('inline;')).toBe(true)
    expect(contentDisposition('a.txt', 'text/plain').startsWith('attachment;')).toBe(true)
    expect(contentDisposition('a.zip', 'application/zip').startsWith('attachment;')).toBe(true)
  })

  it('encodes the UTF-8 name and cannot be broken out of', () => {
    const header = contentDisposition('résumé "x".pdf', 'application/pdf')
    expect(header).toContain(`filename*=UTF-8''r%C3%A9sum%C3%A9%20%22x%22.pdf`)
    expect(header).toContain('filename="r_sum_ _x_.pdf"')
    expect(contentDisposition("it's (1).txt", 'text/plain')).toContain("filename*=UTF-8''it%27s%20%281%29.txt")
  })
})

describe('small helpers', () => {
  it('extensionOf', () => {
    expect(extensionOf('a.tar.GZ')).toBe('gz')
    expect(extensionOf('noext')).toBe('')
    expect(extensionOf('trailing.')).toBe('')
  })
  it('isInlineMime / attachmentKind', () => {
    expect(isInlineMime('image/svg+xml')).toBe(false)
    expect(isInlineMime('text/html')).toBe(false)
    expect(attachmentKind('application/pdf')).toBe('pdf')
    expect(attachmentKind('text/csv')).toBe('sheet')
    expect(attachmentKind('application/x-unknown')).toBe('file')
  })
  it('isUuid / attachmentHref', () => {
    expect(isUuid('6c255dc0-1111-4222-8333-444455556666')).toBe(true)
    expect(isUuid("1' or 1=1")).toBe(false)
    expect(isUuid(undefined)).toBe(false)
    expect(attachmentHref('abc')).toBe('/api/attachments/abc')
  })
})
