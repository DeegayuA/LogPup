import Link from 'next/link'
import { cn } from '@/lib/utils'
import { STATUS_LABEL } from '@/features/sprints/board-view'
import { TASK_TYPE_LABEL } from '@/features/sprints/hierarchy'
import { boardHref } from '@/features/apps/tabs'
import type { WorkTreeRow } from '@/features/sprints/queries'
import { buildWorkTree, type TreeNode } from '@/features/sprints/tree'
import { TaskTypeIcon } from '@/features/sprints/components/task-type-icon'
import { TreeBranch } from '@/features/sprints/components/tree-branch'

// The Backlog tab: the project as Epic -> Feature -> Story -> Task ->
// Sub-task. Rows render on the server; only the expand toggle is client
// (TreeBranch), and it is a sibling of the row's link, never its container —
// see tree-branch.tsx for why <details>/<summary> was dropped.
//
// Containers open by default down to stories, so the first view answers "what
// are we building and how far along is it" without a click; tasks with
// children start closed, since that is where a tree gets long.

const OPEN_BY_DEFAULT = new Set(['epic', 'feature', 'story'])

function Row({ node, slug }: { node: TreeNode<WorkTreeRow>; slug: string }) {
  const done = node.status === 'done'
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <TaskTypeIcon type={node.type} />
      {node.taskKey ? (
        <span className="shrink-0 font-mono text-2xs text-muted-foreground tabular-nums">{node.taskKey}</span>
      ) : null}
      <Link
        href={boardHref(slug, node.sprintId ?? 'backlog', { task: node.id })}
        title={node.title}
        className={cn(
          'truncate text-sm hover:underline focus-visible:underline focus-visible:outline-none',
          done && 'text-muted-foreground line-through',
        )}
      >
        {node.title}
      </Link>
      <span className="sr-only">{TASK_TYPE_LABEL[node.type]}</span>
      <span className="ml-auto flex shrink-0 items-center gap-2 text-2xs text-muted-foreground">
        {node.rollup.items > 0 ? (
          <span className="tabular-nums">
            <span aria-hidden>
              {node.rollup.done}/{node.rollup.items} done
              {node.rollup.points > 0 ? ` · ${node.rollup.points} pts` : ''}
            </span>
            <span className="sr-only">
              {node.rollup.done} of {node.rollup.items} items under this are done
              {node.rollup.points > 0 ? `, ${node.rollup.points} points` : ''}
            </span>
          </span>
        ) : node.storyPoints !== null ? (
          <span className="tabular-nums">{node.storyPoints} pts</span>
        ) : null}
        {node.assigneeName ? <span className="hidden max-w-32 truncate sm:inline">{node.assigneeName}</span> : null}
        <span className={cn('rounded-full px-1.5 py-px', done ? 'bg-muted' : 'border')}>
          {STATUS_LABEL[node.status]}
        </span>
      </span>
    </span>
  )
}

function Branch({ node, slug }: { node: TreeNode<WorkTreeRow>; slug: string }) {
  if (node.children.length === 0) {
    return (
      <li className="flex items-center rounded-md py-1.5 pr-2 pl-6 hover:bg-muted/50">
        <Row node={node} slug={slug} />
      </li>
    )
  }
  const name = node.taskKey ?? node.title
  return (
    <TreeBranch
      label={`Show ${node.children.length} item${node.children.length === 1 ? '' : 's'} under ${name}`}
      defaultOpen={OPEN_BY_DEFAULT.has(node.type)}
      row={<Row node={node} slug={slug} />}
    >
      {node.children.map((child) => (
        <Branch key={child.id} node={child} slug={slug} />
      ))}
    </TreeBranch>
  )
}

export function WorkTree({
  rows, slug, truncated,
}: { rows: WorkTreeRow[]; slug: string; truncated: boolean }) {
  const tree = buildWorkTree(rows)
  if (tree.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        <p className="font-medium text-foreground">No work items yet</p>
        <p className="mt-1">
          Add tasks on the{' '}
          <Link href={boardHref(slug)} className="underline">
            Roadmap
          </Link>
          , then set their Type and Parent to build the tree here.
        </p>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <ul role="list" className="flex flex-col rounded-lg border p-2" aria-label="Work items by hierarchy">
        {tree.map((node) => (
          <Branch key={node.id} node={node} slug={slug} />
        ))}
      </ul>
      {truncated ? (
        <p className="text-2xs text-muted-foreground" role="status">
          Showing the first {rows.length} items. Use ⌘K to find a specific task.
        </p>
      ) : null}
    </div>
  )
}
