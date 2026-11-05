/**
 * Module C vocabulary and pure rules: categories, the line diff behind
 * "compare revisions", task-key linking inside rendered pages, the URL
 * allowlist for rendered links and the editor toolbar's text edits. Pure so
 * the client editor and the server loaders share one tested definition.
 */

export const DOC_CATEGORIES = [
  'project',
  'requirements',
  'architecture',
  'api',
  'database',
  'setup',
  'deployment',
  'qa',
  'runbook',
  'meeting_notes',
  'release_notes',
  'other',
] as const
export type DocCategory = (typeof DOC_CATEGORIES)[number]

/** The PRD's own list, in its order. */
export const DOC_CATEGORY_LABEL: Record<DocCategory, string> = {
  project: 'Project documentation',
  requirements: 'Product requirements',
  architecture: 'Architecture',
  api: 'API documentation',
  database: 'Database design',
  setup: 'Development setup',
  deployment: 'Deployment guide',
  qa: 'QA documentation',
  runbook: 'Runbooks',
  meeting_notes: 'Meeting notes',
  release_notes: 'Release notes',
  other: 'Other',
}

export function parseDocCategory(raw: unknown): DocCategory | null {
  return typeof raw === 'string' && (DOC_CATEGORIES as readonly string[]).includes(raw) ? (raw as DocCategory) : null
}

export const DOC_TITLE_MAX = 160
export const DOC_BODY_MAX = 200_000
export const DOC_SUMMARY_MAX = 200

/** The Docs tab's URL state, one place: ?tab=docs plus doc/mode/from/to/category/q. */
export type DocsUrlState = {
  doc?: string
  mode?: 'edit' | 'history' | 'compare'
  from?: number
  to?: number
  category?: DocCategory
  q?: string
}

export function docsHref(slug: string, state: DocsUrlState = {}): string {
  const params = new URLSearchParams({ tab: 'docs' })
  if (state.category) params.set('category', state.category)
  if (state.q) params.set('q', state.q)
  if (state.doc) params.set('doc', state.doc)
  if (state.mode) params.set('mode', state.mode)
  if (state.from !== undefined) params.set('from', String(state.from))
  if (state.to !== undefined) params.set('to', String(state.to))
  return `/apps/${slug}?${params.toString()}`
}

export type DiffLine ={ kind: 'same' | 'added' | 'removed'; text: string }

/**
 * Line diff of two revisions (longest common subsequence), for "compare".
 * O(n·m) memory; above DIFF_LINE_LIMIT lines per side it degrades to "every
 * old line removed, every new line added" rather than stalling the page.
 */
export const DIFF_LINE_LIMIT = 2000

export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split('\n')
  const b = after.split('\n')
  if (a.length > DIFF_LINE_LIMIT || b.length > DIFF_LINE_LIMIT) {
    return [
      ...a.map((text) => ({ kind: 'removed' as const, text })),
      ...b.map((text) => ({ kind: 'added' as const, text })),
    ]
  }
  const n = a.length
  const m = b.length
  // lcs[i][j] = LCS length of a[i..] and b[j..]
  const lcs: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: 'same', text: a[i] })
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ kind: 'removed', text: a[i++] })
    } else {
      out.push({ kind: 'added', text: b[j++] })
    }
  }
  while (i < n) out.push({ kind: 'removed', text: a[i++] })
  while (j < m) out.push({ kind: 'added', text: b[j++] })
  return out
}

/** "+3 −1" for a revision row. */
export function diffStats(lines: readonly DiffLine[]): { added: number; removed: number } {
  return {
    added: lines.filter((l) => l.kind === 'added').length,
    removed: lines.filter((l) => l.kind === 'removed').length,
  }
}

/**
 * Cheap "+added −removed" for a history list: lines present in one side more
 * often than in the other. Exact for appends and deletions; a moved line
 * counts as unchanged where the LCS diff would show it removed and re-added.
 * Linear, so a list of many revisions never runs the quadratic diff.
 */
export function quickLineStats(before: string, after: string): { added: number; removed: number } {
  const counts = new Map<string, number>()
  if (before !== '') for (const line of before.split('\n')) counts.set(line, (counts.get(line) ?? 0) + 1)
  let added = 0
  if (after !== '') {
    for (const line of after.split('\n')) {
      const left = counts.get(line) ?? 0
      if (left > 0) counts.set(line, left - 1)
      else added++
    }
  }
  let removed = 0
  for (const left of counts.values()) removed += left
  return { added, removed }
}

/**
 * Turn bare task keys ("UNLR-12") in Markdown prose into links to the board's
 * search, leaving code spans, fenced blocks and existing links alone. The key
 * shape matches task-key.ts: 2–6 uppercase letters/digits, a dash, a number.
 */
// The "before" class also excludes URL punctuation (= ? & # : .) so a key
// inside a link target ("…/?id=ABC-12") is never rewritten into a link.
const KEY = /(^|[^\w/[=?&#:.-])([A-Z][A-Z0-9]{1,5}-\d+)\b(?![\]()])/g

/**
 * `hrefFor` returning null leaves that key as plain text: a key that names no
 * live task in this project must not become a link that opens nothing.
 */
export function linkTaskKeys(markdown: string, hrefFor: (key: string) => string | null): string {
  const parts = markdown.split(CODE_SPLIT)
  return parts
    .map((part, index) =>
      index % 2 === 1
        ? part
        : part.replace(KEY, (_m, before: string, key: string) => {
            const href = hrefFor(key)
            return href === null ? `${before}${key}` : `${before}[${key}](${href})`
          }),
    )
    .join('')
}

const CODE_SPLIT = /(```[\s\S]*?```|`[^`\n]*`)/g

/** The distinct task keys linkTaskKeys would consider, so the server can resolve only those. */
export function extractTaskKeys(markdown: string, max = 100): string[] {
  const found = new Set<string>()
  markdown.split(CODE_SPLIT).forEach((part, index) => {
    if (index % 2 === 1) return
    for (const match of part.matchAll(KEY)) {
      if (found.size >= max) return
      found.add(match[2])
    }
  })
  return [...found]
}

/**
 * The only link and image targets a rendered page may carry: web and mail
 * links, same-site paths (which covers /api/attachments/<id>, re-checked by
 * that route on every request) and in-page anchors. Everything else —
 * javascript:, data:, vbscript:, protocol-relative //host — renders as no
 * link at all. react-markdown's own default is looser than this (it allows
 * any scheme it does not recognise as dangerous); pages are written by many
 * people and read by everyone on the project, so this is an allowlist.
 */
export function safeDocUrl(url: string): string | null {
  // Any control character inside the URL refuses it outright: Markdown
  // decodes `&#9;` to a tab, the scheme test below then sees "java\tscript:"
  // as no scheme at all, and browsers strip the tab back out on navigation.
  if (/[\u0000-\u001f\u007f]/.test(url.trim())) return null
  const value = url.trim()
  if (value === '') return null
  if (value.startsWith('#')) return value
  if (value.startsWith('/')) return value.startsWith('//') || value.startsWith('/\\') ? null : value
  if (/^(https?:|mailto:)/i.test(value)) return value
  // A relative path with no scheme ("guide.md", "./img.png"). A colon before
  // the first slash is a scheme, so it is refused.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value) && !value.startsWith('\\')) return value
  return null
}

/**
 * Markdown for an uploaded file: an image embeds, anything else links. The
 * name is the user's own filename, so the characters that would close the
 * label early are escaped.
 */
export function attachmentMarkdown(name: string, id: string, isImage: boolean): string {
  const label = name.replace(/[\\[\]]/g, '\\$&').replace(/\s+/g, ' ')
  return `${isImage ? '!' : ''}[${label}](/api/attachments/${id})`
}

export type ToolbarAction = 'bold' | 'italic' | 'heading' | 'list' | 'checklist' | 'table' | 'code' | 'link'

export type TextEdit = { text: string; selectionStart: number; selectionEnd: number }

const TABLE_SNIPPET = '| Column | Column |\n| --- | --- |\n| Text | Text |'

/**
 * One toolbar button applied to the textarea's text and selection. Pure, so
 * the editor's formatting rules are tested without a DOM. Inline actions
 * wrap the selection (or a placeholder word, left selected so typing
 * replaces it); line actions prefix every selected line; block actions
 * insert on their own lines.
 */
export function applyToolbar(action: ToolbarAction, text: string, start: number, end: number): TextEdit {
  const selected = text.slice(start, end)
  const wrap = (before: string, after: string, placeholder: string): TextEdit => {
    const inner = selected || placeholder
    const next = text.slice(0, start) + before + inner + after + text.slice(end)
    return { text: next, selectionStart: start + before.length, selectionEnd: start + before.length + inner.length }
  }
  const block = (snippet: string): TextEdit => {
    const needsLeadingBreak = start > 0 && text[start - 1] !== '\n'
    const prefix = needsLeadingBreak ? '\n\n' : ''
    const insert = `${prefix}${snippet}\n`
    const next = text.slice(0, start) + insert + text.slice(end)
    const caret = start + insert.length
    return { text: next, selectionStart: caret, selectionEnd: caret }
  }
  const prefixLines = (prefix: string): TextEdit => {
    const lineStart = text.lastIndexOf('\n', start - 1) + 1
    const region = text.slice(lineStart, end)
    const prefixed = region.split('\n').map((line) => (line.startsWith(prefix) ? line : prefix + line)).join('\n')
    const next = text.slice(0, lineStart) + prefixed + text.slice(end)
    return { text: next, selectionStart: lineStart, selectionEnd: lineStart + prefixed.length }
  }

  switch (action) {
    case 'bold':
      return wrap('**', '**', 'bold text')
    case 'italic':
      return wrap('_', '_', 'italic text')
    case 'link':
      return selected
        ? wrap('[', '](https://)', '')
        : wrap('[', '](https://)', 'link text')
    case 'heading':
      return prefixLines('## ')
    case 'list':
      return prefixLines('- ')
    case 'checklist':
      return prefixLines('- [ ] ')
    case 'table':
      return block(TABLE_SNIPPET)
    case 'code':
      return selected.includes('\n') || !selected
        ? block(`\`\`\`\n${selected || 'code'}\n\`\`\``)
        : wrap('`', '`', 'code')
  }
}
