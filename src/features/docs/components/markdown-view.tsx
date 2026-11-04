import Markdown, { type Components, type Options } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { cn } from '@/lib/utils'
import { linkTaskKeys, safeDocUrl } from '@/features/docs/docs'
import styles from './markdown.module.css'

/**
 * A page body, rendered. No hooks, so the same component renders on the
 * server (the page view) and in the editor's client Preview.
 *
 * SAFETY: raw HTML in the Markdown is escaped, never rendered (react-markdown's
 * default; rehype-raw is deliberately absent), and every link and image URL
 * passes safeDocUrl's allowlist — pages are written by many people and read by
 * everyone on the project. Images can only come from our own origin
 * (/api/attachments re-checks access per request) or http(s).
 *
 * `taskLinks` maps a task key the page mentions to its board link; keys the
 * server could not resolve to a live task in this project stay plain text.
 *
 * `remarkPlugins` run after remark-gfm on the parsed tree — the hook chat
 * uses to highlight @mentions (chat/mentions.ts) without enabling raw HTML.
 */

const components: Components = {
  // `node` is react-markdown's hast node; pulled out so it never reaches the DOM.
  a: ({ href, children, node, ...rest }) => {
    void node
    const external = typeof href === 'string' && /^https?:/i.test(href)
    return (
      <a href={href} {...rest} {...(external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}>
        {children}
      </a>
    )
  },
  img: ({ src, alt, node, ...rest }) => {
    void node
    // A plain <img>: user content from /api/attachments or the web, and
    // next/image would need every host allowlisted.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt ?? ''} loading="lazy" {...rest} />
  },
  table: ({ children, node, ...rest }) => {
    void node
    return (
      <div className={styles.tableWrap}>
        <table {...rest}>{children}</table>
      </div>
    )
  },
}

const NO_PLUGINS: NonNullable<Options['remarkPlugins']> = []

export function MarkdownView({
  markdown,
  taskLinks = {},
  className,
  remarkPlugins = NO_PLUGINS,
}: {
  markdown: string
  taskLinks?: Record<string, string>
  className?: string
  remarkPlugins?: NonNullable<Options['remarkPlugins']>
}) {
  const source = linkTaskKeys(markdown, (key) => taskLinks[key] ?? null)
  return (
    <div className={cn(styles.markdown, className)}>
      <Markdown
        remarkPlugins={[remarkGfm, ...remarkPlugins]}
        rehypePlugins={[[rehypeHighlight, { detect: false }]]}
        urlTransform={(url) => safeDocUrl(url)}
        components={components}
      >
        {source}
      </Markdown>
    </div>
  )
}
