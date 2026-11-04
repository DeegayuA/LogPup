import { describe, expect, it } from 'vitest'
import {
  applyToolbar,
  attachmentMarkdown,
  diffLines,
  diffStats,
  docsHref,
  extractTaskKeys,
  linkTaskKeys,
  parseDocCategory,
  quickLineStats,
  safeDocUrl,
} from './docs'

describe('diffLines', () => {
  it('marks added, removed and unchanged lines', () => {
    const d = diffLines('a\nb\nc', 'a\nc\nd')
    expect(d).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'removed', text: 'b' },
      { kind: 'same', text: 'c' },
      { kind: 'added', text: 'd' },
    ])
    expect(diffStats(d)).toEqual({ added: 1, removed: 1 })
  })

  it('treats identical text as all same', () => {
    expect(diffLines('x\ny', 'x\ny').every((l) => l.kind === 'same')).toBe(true)
  })
})

describe('linkTaskKeys', () => {
  const href = (k: string) => `/search?q=${k}`

  it('links bare keys in prose', () => {
    expect(linkTaskKeys('See UNLR-12 and SHOP-3.', href)).toBe('See [UNLR-12](/search?q=UNLR-12) and [SHOP-3](/search?q=SHOP-3).')
  })

  it('leaves code and existing links alone', () => {
    expect(linkTaskKeys('`UNLR-12` and [UNLR-4](x)', href)).toBe('`UNLR-12` and [UNLR-4](x)')
    expect(linkTaskKeys('```\nUNLR-1\n```', href)).toBe('```\nUNLR-1\n```')
  })
})

describe('docsHref', () => {
  it('builds the tab URL with only the params given', () => {
    expect(docsHref('shop')).toBe('/apps/shop?tab=docs')
    expect(docsHref('shop', { doc: 'd1', mode: 'compare', from: 2, to: 5 })).toBe(
      '/apps/shop?tab=docs&doc=d1&mode=compare&from=2&to=5',
    )
    expect(docsHref('shop', { category: 'api', q: 'a b' })).toBe('/apps/shop?tab=docs&category=api&q=a+b')
  })
})

describe('quickLineStats', () => {
  it('counts lines only on one side', () => {
    expect(quickLineStats('a\nb\nc', 'a\nc\nd\nd')).toEqual({ added: 2, removed: 1 })
    expect(quickLineStats('', 'x\ny')).toEqual({ added: 2, removed: 0 })
    expect(quickLineStats('x', 'x')).toEqual({ added: 0, removed: 0 })
  })
})

describe('linkTaskKeys with unresolved keys', () => {
  it('leaves a key as plain text when hrefFor returns null', () => {
    expect(linkTaskKeys('UNLR-1 and UNLR-2', (k) => (k === 'UNLR-1' ? '/a' : null))).toBe('[UNLR-1](/a) and UNLR-2')
  })
})

describe('extractTaskKeys', () => {
  it('finds distinct keys outside code', () => {
    expect(extractTaskKeys('UNLR-1, UNLR-1 and `UNLR-2` plus SHOP-9')).toEqual(['UNLR-1', 'SHOP-9'])
  })
})

describe('safeDocUrl', () => {
  it('allows web, mail, same-site and relative targets', () => {
    for (const ok of ['https://x.io', 'http://x.io', 'mailto:a@b.c', '/api/attachments/abc', '#top', 'guide.md', './a.png']) {
      expect(safeDocUrl(ok)).toBe(ok)
    }
  })
  it('refuses scripts, data and protocol-relative urls', () => {
    for (const bad of ['javascript:alert(1)', ' JAVASCRIPT:x', 'data:text/html,x', 'vbscript:x', '//evil.io', '/\\evil.io', '']) {
      expect(safeDocUrl(bad)).toBeNull()
    }
  })
})

describe('safeDocUrl with decoded control characters', () => {
  it('refuses a scheme split by a tab or newline (from &#9; / &#10;)', () => {
    expect(safeDocUrl('java\tscript:alert(1)')).toBeNull()
    expect(safeDocUrl('da\nta:text/html,x')).toBeNull()
  })
})

describe('linkTaskKeys inside URLs', () => {
  it('leaves keys in link targets and bare URLs alone', () => {
    const href = () => '/x'
    expect(linkTaskKeys('[spec](https://x.io/?id=ABC-12)', href)).toBe('[spec](https://x.io/?id=ABC-12)')
    expect(linkTaskKeys('https://x.io/?id=ABC-12', href)).toBe('https://x.io/?id=ABC-12')
    expect(linkTaskKeys('See ABC-12.', href)).toBe('See [ABC-12](/x).')
  })
})

describe('attachmentMarkdown', () => {
  it('embeds images, links files and escapes the label', () => {
    expect(attachmentMarkdown('a.png', 'id1', true)).toBe('![a.png](/api/attachments/id1)')
    expect(attachmentMarkdown('x]y.pdf', 'id2', false)).toBe('[x\\]y.pdf](/api/attachments/id2)')
  })
})

describe('applyToolbar', () => {
  it('wraps the selection in bold', () => {
    const r = applyToolbar('bold', 'say hi now', 4, 6)
    expect(r.text).toBe('say **hi** now')
    expect(r.text.slice(r.selectionStart, r.selectionEnd)).toBe('hi')
  })
  it('inserts a placeholder when nothing is selected', () => {
    const r = applyToolbar('italic', '', 0, 0)
    expect(r.text).toBe('_italic text_')
    expect(r.text.slice(r.selectionStart, r.selectionEnd)).toBe('italic text')
  })
  it('prefixes every selected line for a checklist', () => {
    expect(applyToolbar('checklist', 'a\nb', 0, 3).text).toBe('- [ ] a\n- [ ] b')
  })
  it('prefixes the whole current line for a heading', () => {
    expect(applyToolbar('heading', 'one\ntwo', 5, 5).text).toBe('one\n## two')
  })
  it('puts a table on its own lines', () => {
    expect(applyToolbar('table', 'text', 4, 4).text.startsWith('text\n\n| Column')).toBe(true)
  })
  it('uses a fenced block for multi-line code', () => {
    expect(applyToolbar('code', 'a\nb', 0, 3).text).toBe('```\na\nb\n```\n')
    expect(applyToolbar('code', 'x y', 0, 1).text).toBe('`x` y')
  })
})

describe('parseDocCategory', () => {
  it('accepts only known categories', () => {
    expect(parseDocCategory('runbook')).toBe('runbook')
    expect(parseDocCategory('nope')).toBeNull()
  })
})
