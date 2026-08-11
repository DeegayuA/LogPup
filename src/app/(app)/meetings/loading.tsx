export default function MeetingsLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Meetings</h1>
      </div>
      <div className="flex w-full max-w-3xl flex-col gap-6" aria-hidden>
        {[3, 2].map((rowCount, groupIndex) => (
          <div key={groupIndex} className="flex flex-col gap-2">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="divide-y divide-border rounded-lg border bg-card">
              {Array.from({ length: rowCount }).map((_, rowIndex) => (
                <div key={rowIndex} className="flex items-center gap-3 px-4 py-3">
                  <div className="h-3.5 w-20 animate-pulse rounded bg-muted" />
                  <div className="h-3.5 w-44 animate-pulse rounded bg-muted" />
                  <div className="ml-auto h-3.5 w-10 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
