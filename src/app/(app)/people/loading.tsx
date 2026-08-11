import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const shimmer = 'animate-pulse rounded-md bg-muted motion-reduce:animate-none'

export default function PeopleLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <span className="sr-only" role="status">
        Loading people…
      </span>
      <div className="flex flex-col gap-4" aria-hidden>
        <div className="flex items-baseline gap-3">
          <h1 className="font-heading text-2xl font-bold tracking-tight">People</h1>
          <div className={cn(shimmer, 'h-4 w-16')} />
        </div>
        <div className={cn(shimmer, 'h-8 w-full max-w-sm rounded-lg')} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className={cn(shimmer, 'size-10 rounded-full')} />
                <div className="flex flex-col gap-1.5">
                  <div className={cn(shimmer, 'h-4 w-28')} />
                  <div className={cn(shimmer, 'h-3 w-20')} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className={cn(shimmer, 'h-2 flex-1 rounded-full')} />
                <div className={cn(shimmer, 'h-3 w-8')} />
              </div>
              <div className="flex gap-1.5">
                <div className={cn(shimmer, 'h-5 w-20 rounded-4xl')} />
                <div className={cn(shimmer, 'h-5 w-16 rounded-4xl')} />
                <div className={cn(shimmer, 'h-5 w-14 rounded-4xl')} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
