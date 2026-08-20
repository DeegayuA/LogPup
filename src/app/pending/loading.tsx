import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { BrandMark } from '@/components/shell/brand-mark'

/**
 * /pending sits outside the (app) group, so without this file the
 * post-sign-in redirect here had NO designed intermediate state while the
 * session and phone reads ran. The title can't be pre-rendered — pending vs
 * rejected is exactly what's being read — so the heading shimmers too.
 */
export default function PendingLoading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4 py-10">
      <span className="sr-only" role="status">
        Checking your approval status…
      </span>
      <BrandMark />
      <div className="flex w-full max-w-md flex-col gap-4" aria-hidden>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <Card>
          <CardContent className="flex flex-col gap-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-40" />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
