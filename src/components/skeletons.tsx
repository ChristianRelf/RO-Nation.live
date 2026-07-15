// Brand-aware loading placeholders. Every colour here is a themed utility
// (bg-elev, border-line, card) resolved from data-brand on <html>, so a partner's
// loading state comes out in the partner's palette, not RNL's - the same reason
// error.tsx can stay unstyled-per-brand and still look right.

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-[3px] bg-elev ${className}`} />;
}

/** The kicker + big title + lead paragraph every data page opens with. */
export function PageHeaderSkeleton() {
  return (
    <div className="shell relative pt-16 sm:pt-20">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-5 h-14 w-64 sm:h-16 sm:w-96" />
      <Skeleton className="mt-6 h-5 w-full max-w-xl" />
    </div>
  );
}

/** A responsive grid of poster-topped cards - events, blog, careers. */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card overflow-hidden">
          <Skeleton className="aspect-[16/11] w-full rounded-none" />
          <div className="space-y-3 p-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
