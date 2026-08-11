import { PawPrint } from 'lucide-react'

// Minimal branded header for standalone pages that sit outside the (app)
// route group's sidebar/header shell and outside /sign-in's two-pane layout
// — currently /pending and /auth-error. Both need the same small "you're
// still in LogPup" chrome above a centered card.
export function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <PawPrint className="size-4" aria-hidden />
      </div>
      <span className="font-heading text-lg font-bold tracking-tight">LogPup</span>
    </div>
  )
}
