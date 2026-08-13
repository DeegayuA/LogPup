import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const shimmer = 'animate-pulse rounded-md bg-muted motion-reduce:animate-none'

/**
 * Settings reads three rows off the database (keys, avatar, job role) before
 * it can render, so it owes a designed loading state like every other async
 * surface here. Same skeleton grammar as the dashboard's: a live-region
 * announcement for screen readers, and `aria-hidden` shapes for everyone
 * else, in the same stack the real page uses so nothing jumps on swap.
 */
export default function SettingsLoading() {
  return (
    <div className="flex flex-1 flex-col p-4 sm:p-6">
      <span className="sr-only" role="status">
        Loading your settings…
      </span>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6" aria-hidden>
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight">Settings</h1>
          <div className={cn(shimmer, 'h-4 w-72 max-w-full')} />
        </div>

        <Card>
          <CardHeader>
            <div className={cn(shimmer, 'h-5 w-16')} />
            <div className={cn(shimmer, 'h-4 w-64 max-w-full')} />
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <div className={cn(shimmer, 'size-10 rounded-full')} />
            <div className="flex flex-1 flex-col gap-1.5">
              <div className={cn(shimmer, 'h-4 w-40 max-w-full')} />
              <div className={cn(shimmer, 'h-3 w-56 max-w-full')} />
            </div>
          </CardContent>
        </Card>

        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className={cn(shimmer, 'h-5 w-28')} />
              <div className={cn(shimmer, 'h-4 w-60 max-w-full')} />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className={cn(shimmer, 'h-4 w-full')} />
              <div className={cn(shimmer, 'h-4 w-2/3')} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
