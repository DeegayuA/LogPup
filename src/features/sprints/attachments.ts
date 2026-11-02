// Task attachments: the pure rules shared by the upload route, the server
// actions and the client pre-check. Nothing here touches the network or the
// database, so every security decision about an uploaded file is unit tested
// in attachments.test.ts rather than only exercised through a route.
//
// THE TRUST MODEL. Everything about an upload except its bytes is a claim:
// the filename, the extension and the browser's declared MIME type are all
// typed by whoever built the request. So a file must agree with itself three
// ways — extension on the allowlist, declared type one that extension is
// known to arrive as, and (for every binary format) leading bytes that are
// actually that format. The type we STORE is then our canonical one for the
// extension, never the client's string, because the download route serves it
// back as Content-Type.
//
// SVG and HTML are absent on purpose, not by omission: both are documents a
// browser will run script in, and the download route serves from our own
// origin. An extension-only allowlist that let `.svg` through would be a
// stored-XSS hole in every task.

// 4 MB, not more: on Vercel a function's request body is capped near 4.5 MB,
// so a larger limit here would be a promise the upload route cannot keep.
// Raising it means client-side Blob uploads (@vercel/blob/client) first.
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024
export const MAX_ATTACHMENTS_PER_TASK = 20

/** How the leading bytes of a file must look. `text` means "not binary". */
type Sniff = 'png' | 'jpeg' | 'gif' | 'webp' | 'pdf' | 'zip' | 'text'

export type AttachmentKind = 'image' | 'pdf' | 'text' | 'archive' | 'doc' | 'sheet' | 'slides' | 'file'

type AllowedType = {
  /** What we store and serve, whatever the browser claimed. */
  mime: string
  /**
   * Every declared type this extension is known to arrive as. Browsers are
   * inconsistent here — Windows reports .csv as Excel's type, and most
   * browsers send an empty type for .md — so a strict one-to-one match would
   * refuse ordinary files. An unknown claim is still refused.
   */
  accepts: readonly string[]
  sniff: Sniff
  kind: AttachmentKind
}

const OOXML_ACCEPTS_EXTRA = ['application/zip', 'application/octet-stream'] as const

const ALLOWED: Record<string, AllowedType> = {
  png: { mime: 'image/png', accepts: ['image/png'], sniff: 'png', kind: 'image' },
  jpg: { mime: 'image/jpeg', accepts: ['image/jpeg', 'image/pjpeg'], sniff: 'jpeg', kind: 'image' },
  jpeg: { mime: 'image/jpeg', accepts: ['image/jpeg', 'image/pjpeg'], sniff: 'jpeg', kind: 'image' },
  gif: { mime: 'image/gif', accepts: ['image/gif'], sniff: 'gif', kind: 'image' },
  webp: { mime: 'image/webp', accepts: ['image/webp'], sniff: 'webp', kind: 'image' },
  pdf: { mime: 'application/pdf', accepts: ['application/pdf'], sniff: 'pdf', kind: 'pdf' },
  txt: { mime: 'text/plain', accepts: ['text/plain', ''], sniff: 'text', kind: 'text' },
  csv: {
    mime: 'text/csv',
    accepts: ['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel', ''],
    sniff: 'text',
    kind: 'sheet',
  },
  md: { mime: 'text/markdown', accepts: ['text/markdown', 'text/x-markdown', 'text/plain', ''], sniff: 'text', kind: 'text' },
  zip: {
    mime: 'application/zip',
    accepts: ['application/zip', 'application/x-zip-compressed', 'application/x-zip', 'multipart/x-zip'],
    sniff: 'zip',
    kind: 'archive',
  },
  // Office Open XML documents are zip containers, so they sniff as zip.
  docx: {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    accepts: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', ...OOXML_ACCEPTS_EXTRA],
    sniff: 'zip',
    kind: 'doc',
  },
  xlsx: {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    accepts: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ...OOXML_ACCEPTS_EXTRA],
    sniff: 'zip',
    kind: 'sheet',
  },
  pptx: {
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    accepts: ['application/vnd.openxmlformats-officedocument.presentationml.presentation', ...OOXML_ACCEPTS_EXTRA],
    sniff: 'zip',
    kind: 'slides',
  },
}

/** For the hidden <input accept>: a hint to the picker, never a check. */
export const ATTACHMENT_ACCEPT = Object.keys(ALLOWED).map((ext) => `.${ext}`).join(',')

export const ALLOWED_TYPES_LABEL = 'images (PNG, JPEG, GIF, WebP), PDF, TXT, CSV, Markdown, ZIP, Word, Excel or PowerPoint'

/** Bytes the server reads from the front of a file before trusting it. */
export const SNIFF_BYTES = 4096

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  if (dot < 0 || dot === name.length - 1) return ''
  return name.slice(dot + 1).toLowerCase()
}

export type AttachmentCheck =
  | { ok: true; ext: string; mime: string; kind: AttachmentKind }
  | { ok: false; error: string; status: 400 | 413 | 415 }

/**
 * Everything that can be decided without reading the file: size, extension,
 * declared type. The client runs this before uploading so a wrong file fails
 * instantly with a sentence instead of after a 10 MB round trip; the server
 * runs it again because the client is not the one deciding.
 */
export function checkAttachmentMeta(input: { name: string; type: string; size: number }): AttachmentCheck {
  if (input.size <= 0) return { ok: false, error: 'That file is empty', status: 400 }
  if (input.size > MAX_ATTACHMENT_BYTES) {
    return { ok: false, error: `That file is ${formatBytes(input.size)} — the limit is ${formatBytes(MAX_ATTACHMENT_BYTES)}`, status: 413 }
  }
  const ext = extensionOf(input.name)
  const allowed = ALLOWED[ext]
  if (!allowed) return { ok: false, error: `That file type isn't allowed. Attach ${ALLOWED_TYPES_LABEL}.`, status: 415 }
  // Parameters ("text/plain; charset=utf-8") are not part of the type.
  const declared = input.type.split(';')[0].trim().toLowerCase()
  if (!allowed.accepts.includes(declared)) {
    return { ok: false, error: `That file says it is "${declared || 'unknown'}", which doesn't match .${ext}`, status: 415 }
  }
  return { ok: true, ext, mime: allowed.mime, kind: allowed.kind }
}

function startsWith(head: Uint8Array, bytes: readonly number[], offset = 0): boolean {
  if (head.length < offset + bytes.length) return false
  return bytes.every((b, i) => head[offset + i] === b)
}

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0))

// Leading markup a browser would treat as a document. A .txt is served as
// text/plain with nosniff, so this is belt and braces — but it is also the
// signature of somebody renaming page.html to notes.txt, which no honest
// upload does.
const MARKUP_PREFIXES = ['<!doctype', '<html', '<script', '<svg', '<?xml', '<iframe', '<body', '<head']

/**
 * Does `head` (the first bytes of the file) look like the format its
 * extension promises? `head` should be up to SNIFF_BYTES long.
 */
export function sniffMatches(ext: string, head: Uint8Array): boolean {
  const allowed = ALLOWED[ext]
  if (!allowed) return false
  switch (allowed.sniff) {
    case 'png':
      return startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    case 'jpeg':
      return startsWith(head, [0xff, 0xd8, 0xff])
    case 'gif':
      return startsWith(head, ascii('GIF87a')) || startsWith(head, ascii('GIF89a'))
    case 'webp':
      return startsWith(head, ascii('RIFF')) && startsWith(head, ascii('WEBP'), 8)
    case 'pdf':
      return startsWith(head, ascii('%PDF-'))
    case 'zip':
      // Local file header, or the end-of-central-directory record that is the
      // whole of an empty archive.
      return startsWith(head, [0x50, 0x4b, 0x03, 0x04]) || startsWith(head, [0x50, 0x4b, 0x05, 0x06])
    case 'text': {
      // A NUL byte never appears in UTF-8 text; it is the cheapest reliable
      // tell that a binary was renamed to .txt.
      if (head.includes(0)) return false
      let start = 0
      if (startsWith(head, [0xef, 0xbb, 0xbf])) start = 3 // UTF-8 BOM
      const prefix = new TextDecoder('utf-8', { fatal: false })
        .decode(head.subarray(start, Math.min(head.length, start + 64)))
        .trimStart()
        .toLowerCase()
      return !MARKUP_PREFIXES.some((m) => prefix.startsWith(m))
    }
  }
}

// Bidi overrides and isolates let "invoice\u202Efdp.exe" display as
// "invoiceexe.pdf"; zero-width characters make two names look identical.
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/g
const RESERVED = /[<>:"/\\|?*]/g
const MAX_NAME_LENGTH = 120

/**
 * The display name kept in `attachments.name`. It is never part of a storage
 * path (those are random), so this is about what a person reads and what the
 * Content-Disposition header carries: no directories, no control or bidi
 * characters, nothing a filesystem refuses, and a length that fits a row.
 */
export function sanitizeFileName(raw: string): string {
  // Some browsers (old Edge, IE) send the full client path.
  const base = raw.split(/[\\/]/).pop() ?? ''
  let name = base
    .normalize('NFC')
    .replace(CONTROL, '')
    .replace(RESERVED, '_')
    .replace(/\s+/g, ' ')
    .trim()
    // Leading dots would make a hidden file on download; trailing dots and
    // spaces are silently stripped by Windows, changing the extension.
    .replace(/^[.\s]+/, '')
    .replace(/[.\s]+$/, '')

  if (name.length > MAX_NAME_LENGTH) {
    const ext = extensionOf(name)
    const keep = ext && ext.length <= 10 ? `.${ext}` : ''
    name = name.slice(0, MAX_NAME_LENGTH - keep.length).trimEnd() + keep
  }
  return name || 'file'
}

/** 1536 → "1.5 KB". Binary units, labelled the way people read them. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded} ${units[unit]}`
}

/** Only formats the browser renders without running anything of ours. */
export function isInlineMime(mime: string): boolean {
  return mime === 'application/pdf' || ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(mime)
}

export function attachmentKind(mime: string): AttachmentKind {
  for (const allowed of Object.values(ALLOWED)) if (allowed.mime === mime) return allowed.kind
  return 'file'
}

/**
 * RFC 6266 header: an ASCII fallback for old clients plus the exact UTF-8
 * name in filename*. The fallback strips quotes and backslashes so the
 * quoted-string can never be closed early (header injection).
 */
export function contentDisposition(name: string, mime: string): string {
  const disposition = isInlineMime(mime) ? 'inline' : 'attachment'
  const fallback = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_') || 'file'
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

export const attachmentHref = (id: string) => `/api/attachments/${id}`

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Postgres rejects a malformed uuid with an error; refuse it before the query. */
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value)
