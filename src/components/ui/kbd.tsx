import { cn } from "@/lib/utils"

/**
 * The one keyboard-key chip. The shell grew three divergent kbd treatments
 * (sidebar row hints, the ⌘K trigger chip, the palette footer) — same
 * concept, three borders. This is the single shape they converge on.
 *
 * Mono because a key cap is a data value, not prose; text-2xs is the
 * repo's fine-print floor (globals.css defines it at 11px/16px).
 */
function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex select-none items-center gap-0.5 rounded border border-border bg-muted px-1 py-0.5 font-mono text-2xs leading-none text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Kbd }
