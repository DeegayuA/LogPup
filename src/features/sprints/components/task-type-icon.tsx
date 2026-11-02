import {
  BookOpen, Bug, CornerDownRight, FlaskConical, Layers, Puzzle, SquareCheck, TrendingUp, Wrench,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TASK_TYPE_LABEL, type TaskType } from '@/features/sprints/hierarchy'

// Shape, not colour, tells the types apart: the identity palette
// (event-color.ts) is already spoken for by people and projects, and a ninth
// hue system would compete with it. Bug alone borrows the destructive tone.
const ICON: Record<TaskType, LucideIcon> = {
  epic: Layers,
  feature: Puzzle,
  story: BookOpen,
  task: SquareCheck,
  subtask: CornerDownRight,
  bug: Bug,
  improvement: TrendingUp,
  tech_debt: Wrench,
  spike: FlaskConical,
}

/**
 * Decorative by default: almost everywhere it sits beside its own label (the
 * Type select) or inside a region that is already spelled out for screen
 * readers (the card's cardLabel), where a second name reads "Bug Bug". Pass
 * `labelled` only where the icon stands alone.
 */
export function TaskTypeIcon({
  type, className, labelled = false,
}: { type: TaskType; className?: string; labelled?: boolean }) {
  const Icon = ICON[type]
  return (
    <Icon
      className={cn('size-3.5 shrink-0', type === 'bug' ? 'text-destructive' : 'text-muted-foreground', className)}
      {...(labelled ? { role: 'img', 'aria-label': TASK_TYPE_LABEL[type] } : { 'aria-hidden': true })}
    />
  )
}
