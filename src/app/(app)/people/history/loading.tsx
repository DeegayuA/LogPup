const shimmer = 'animate-pulse rounded-md bg-muted motion-reduce:animate-none'

/**
 * Mirrors the real page block for block — header, pickers, six stat tiles, the
 * trend/overload pair, then the table — so nothing jumps when the data lands.
 * The sibling /people route has had one of these since it was built; this
 * route had none, which is why it flashed an empty frame on every date change.
 */
export default function LoadingCapacityHistory() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <span className="sr-only" role="status">
        Loading capacity history
      </span>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <div className={`${shimmer} h-7 w-52`} />
            <div className={`${shimmer} h-4 w-80`} />
          </div>
          <div className={`${shimmer} h-8 w-24`} />
        </div>
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4].map((chip) => (
            <div key={chip} className={`${shimmer} h-8 w-28`} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2].map((tab) => (
            <div key={tab} className={`${shimmer} h-8 w-24`} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-6">
        {[0, 1, 2, 3, 4, 5].map((tile) => (
          <div key={tile} className={`${shimmer} h-[4.75rem]`} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className={`${shimmer} h-56`} />
        <div className={`${shimmer} h-56`} />
      </div>

      <div className={`${shimmer} h-96`} />
    </div>
  )
}
