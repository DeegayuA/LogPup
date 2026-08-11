import { cn } from '@/lib/utils'

const shimmer = 'animate-pulse rounded-md bg-muted motion-reduce:animate-none'

export default function PeopleLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <span className="sr-only" role="status">
        Loading people…
      </span>
      {/* Mirrors the directory the page actually renders — header + search,
          4-tile stat strip, filter/sort row, single-column dense row list. */}
      <div className="flex flex-col gap-4" aria-hidden>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="font-heading text-2xl font-bold tracking-tight">People</h1>
            <div className={cn(shimmer, 'h-4 w-64')} />
          </div>
          <div className={cn(shimmer, 'h-9 w-full max-w-xs rounded-lg')} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex flex-col gap-1.5 rounded-xl border bg-card p-3">
              <div className={cn(shimmer, 'h-6 w-12')} />
              <div className={cn(shimmer, 'h-3 w-20')} />
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3" aria-hidden>
        <div className="flex items-center justify-between gap-2">
          <div className={cn(shimmer, 'h-7 w-40 rounded-full')} />
          <div className={cn(shimmer, 'h-8 w-44 rounded-lg')} />
        </div>
        <div className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className={cn(shimmer, 'size-8 shrink-0 rounded-full')} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className={cn(shimmer, 'h-4 w-32')} />
                <div className={cn(shimmer, 'h-3 w-24')} />
              </div>
              <div className={cn(shimmer, 'h-2 w-40 shrink-0 rounded-full')} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
