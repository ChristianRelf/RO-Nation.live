import { Skeleton } from "@/components/skeletons";

// Mirrors the event page's shape: full-bleed banner, title overlapping it, a
// details grid and the sticky reserve panel - so the swap to real content doesn't
// jump the layout around.
export default function Loading() {
  return (
    <article>
      <div className="relative">
        <Skeleton className="h-[42vh] min-h-[320px] w-full rounded-none sm:h-[52vh]" />
        <div className="shell relative -mt-28 pb-2 sm:-mt-32">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-4 h-16 w-full max-w-2xl" />
        </div>
      </div>

      <div className="shell grid gap-10 py-12 lg:grid-cols-[1.6fr_1fr] lg:gap-14">
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <Skeleton className="h-48 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    </article>
  );
}
