import { Fragment, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Renders the small Markdown subset Gemini returns in meeting summaries —
 * `###` headings, `**bold**`, `-` bullets and `---` rules — which was
 * previously printed verbatim as literal asterisks and hashes.
 *
 * Builds React nodes directly rather than setting innerHTML: the text is
 * model output, so it must never be able to inject markup.
 */

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  // Split on **bold**, keeping the delimited content as odd-indexed parts.
  return text.split(/\*\*(.+?)\*\*/g).map((part, index) =>
    index % 2 === 1 ? (
      <strong key={`${keyPrefix}-b${index}`} className="font-semibold text-foreground">
        {part}
      </strong>
    ) : (
      <Fragment key={`${keyPrefix}-t${index}`}>{part}</Fragment>
    ),
  )
}

export function MarkdownLite({ content, className }: { content: string; className?: string }) {
  const lines = content.split('\n')
  const blocks: ReactNode[] = []
  let bullets: string[] = []

  const flushBullets = () => {
    if (bullets.length === 0) return
    const items = bullets
    bullets = []
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="flex list-disc flex-col gap-1 pl-5">
        {items.map((item, index) => (
          <li key={`${blocks.length}-${index}`}>
            {renderInline(item, `li${blocks.length}-${index}`)}
          </li>
        ))}
      </ul>,
    )
  }

  lines.forEach((raw, index) => {
    const line = raw.trimEnd()

    if (/^\s*$/.test(line)) {
      flushBullets()
      return
    }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushBullets()
      blocks.push(<hr key={`hr-${index}`} className="border-border" />)
      return
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      flushBullets()
      blocks.push(
        <h5
          key={`h-${index}`}
          className="font-heading text-sm font-semibold tracking-tight text-foreground"
        >
          {renderInline(heading[2], `h${index}`)}
        </h5>,
      )
      return
    }

    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line)
    if (bullet) {
      bullets.push(bullet[1])
      return
    }

    flushBullets()
    blocks.push(<p key={`p-${index}`}>{renderInline(line, `p${index}`)}</p>)
  })
  flushBullets()

  return <div className={cn('flex flex-col gap-2 text-sm leading-relaxed', className)}>{blocks}</div>
}
