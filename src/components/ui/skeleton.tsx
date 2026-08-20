import { cn } from "@/lib/utils"

/**
 * One skeleton for the whole app. Before this existed every feature
 * hand-rolled its shimmer (admin even shipped its own audit-skeleton.tsx),
 * so loading states drifted apart in radius, tone and motion.
 *
 * `animate-pulse` rather than a sweep: a sweep reads as progress, and a
 * skeleton must promise shape, not progress. Respects reduced motion via
 * Tailwind's own motion-reduce variant.
 *
 * Size it at the call site to MATCH THE RESOLVED LAYOUT — a skeleton that
 * doesn't match what replaces it is worse than a spinner, because the swap
 * becomes a layout shift with extra steps.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn(
        "animate-pulse rounded-md bg-muted motion-reduce:animate-none",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
