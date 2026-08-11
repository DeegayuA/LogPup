import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const shimmer = 'animate-pulse rounded-md bg-muted motion-reduce:animate-none'

export default function DashboardLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <span className="sr-only" role="status">
        Loading dashboard…
      </span>
      <div className="flex flex-col gap-1" aria-hidden>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Dashboard</h1>
        <div className={cn(shimmer, 'h-4 w-64')} />
      </div>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2" aria-hidden>
        <Card>
          <CardHeader>
            <div className={cn(shimmer, 'h-5 w-32')} />
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-border">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className={cn(shimmer, 'size-8 rounded-full')} />
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className={cn(shimmer, 'h-4 w-32')} />
                  <div className="flex items-center gap-2">
                    <div className={cn(shimmer, 'h-2 flex-1 rounded-full')} />
                    <div className={cn(shimmer, 'h-3 w-8')} />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <div className={cn(shimmer, 'h-5 w-28')} />
            </CardHeader>
            <CardContent>
              <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
                {Array.from({ length: 2 }, (_, i) => (
                  <div key={i} className="flex flex-col gap-2 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className={cn(shimmer, 'h-4 w-32')} />
                      <div className={cn(shimmer, 'h-3 w-16')} />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className={cn(shimmer, 'h-3 w-24')} />
                      <div className={cn(shimmer, 'h-3 w-28')} />
                    </div>
                    <div className={cn(shimmer, 'h-1.5 w-full rounded-full')} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className={cn(shimmer, 'h-5 w-40')} />
            </CardHeader>
            <CardContent>
              <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className={cn(shimmer, 'h-4 w-40')} />
                    <div className={cn(shimmer, 'h-3 w-28')} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
