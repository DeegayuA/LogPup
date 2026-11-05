/**
 * @mentions as they RENDER in a message: "@Ann Perera" becomes a highlighted
 * link to that person's profile when Ann is someone this conversation knows.
 *
 * A REMARK PLUGIN, not a regex over the Markdown source and not raw HTML:
 * MarkdownView escapes HTML on purpose (rehype-raw is absent), and rewriting
 * the source would also rewrite "@Ann" inside `code` and inside a link label.
 * Working on mdast text nodes leaves code, inline code and existing links
 * alone, and the href still goes through safeDocUrl like every other link.
 *
 * The match rule is extractMentionedUserIds' (notifications/notify.ts): the
 * @ starts the text or follows whitespace, the name matches case-insensitively,
 * and whitespace, the end or light punctuation follows. Longest name first, so
 * "@Ann Perera" is never cut down to "@Ann". Same rule, so what is highlighted
 * is what pinged.
 */

export type MentionPerson = { id: string; name: string }

export type MentionPiece =
  | { type: 'text'; value: string }
  | { type: 'mention'; value: string; person: MentionPerson }

const AFTER = /[\s.,!?;:]/

/** Split one run of plain text into text and mention pieces. Pure. */
export function splitMentions(text: string, people: readonly MentionPerson[]): MentionPiece[] {
  if (!text.includes('@') || people.length === 0) return [{ type: 'text', value: text }]
  const byLength = people.filter((p) => p.name.trim().length > 0).sort((a, b) => b.name.length - a.name.length)
  const out: MentionPiece[] = []
  let pending = ''
  let i = 0
  while (i < text.length) {
    if (text[i] === '@' && (i === 0 || /\s/.test(text[i - 1]))) {
      const hit = byLength.find((p) => {
        const candidate = text.slice(i + 1, i + 1 + p.name.length)
        const next = text[i + 1 + p.name.length]
        return candidate.toLowerCase() === p.name.toLowerCase() && (next === undefined || AFTER.test(next))
      })
      if (hit) {
        if (pending) out.push({ type: 'text', value: pending })
        pending = ''
        const value = text.slice(i, i + 1 + hit.name.length)
        out.push({ type: 'mention', value, person: hit })
        i += value.length
        continue
      }
    }
    pending += text[i]
    i += 1
  }
  if (pending) out.push({ type: 'text', value: pending })
  return out
}

/** The slice of mdast this plugin touches. Local, so no transitive type package is imported. */
type MdNode = {
  type: string
  value?: string
  url?: string
  title?: string | null
  children?: MdNode[]
  data?: { hProperties?: Record<string, unknown> }
}

/** Nodes whose text is not prose: code is literal, and a link inside a link is invalid. */
const SKIP = new Set(['link', 'linkReference', 'code', 'inlineCode', 'definition', 'html'])

export function mentionHref(person: MentionPerson): string {
  return `/people/${encodeURIComponent(person.id)}`
}

function rewrite(node: MdNode, people: readonly MentionPerson[]): void {
  if (!node.children || SKIP.has(node.type)) return
  const next: MdNode[] = []
  for (const child of node.children) {
    if (child.type !== 'text' || typeof child.value !== 'string') {
      rewrite(child, people)
      next.push(child)
      continue
    }
    for (const piece of splitMentions(child.value, people)) {
      if (piece.type === 'text') next.push({ type: 'text', value: piece.value })
      else
        next.push({
          type: 'link',
          url: mentionHref(piece.person),
          title: null,
          children: [{ type: 'text', value: piece.value }],
          // Rendered as data-mention; markdown.module.css styles that attribute.
          data: { hProperties: { dataMention: piece.person.id } },
        })
    }
  }
  node.children = next
}

/**
 * The plugin, bound to the people this conversation knows. Build it once per
 * conversation (useMemo), not per message.
 */
export function remarkMentions(people: readonly MentionPerson[]) {
  return function attacher() {
    return function transformer(tree: { type: string }) {
      if (people.length > 0) rewrite(tree as MdNode, people)
    }
  }
}
