import { PageHeaderSkeleton, CardGridSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="relative">
      <PageHeaderSkeleton />
      <section className="shell py-14">
        <CardGridSkeleton count={6} />
      </section>
    </div>
  );
}
