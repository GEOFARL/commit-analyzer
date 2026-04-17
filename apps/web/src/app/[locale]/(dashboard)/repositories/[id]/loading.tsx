import { Skeleton } from "@/components/ui/skeleton";

const SummarySkeleton = () => (
  <div className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
    <Skeleton className="h-3 w-24" />
    <Skeleton className="h-7 w-20" />
  </div>
);

const ChartSkeleton = ({ height = "h-64" }: { height?: string }) => (
  <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
    <div>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-2 h-3 w-56" />
    </div>
    <Skeleton className={`${height} w-full rounded-xl`} />
  </div>
);

export default function RepositoryAnalyticsLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-3 h-8 w-72" />
        <Skeleton className="mt-2 h-4 w-96" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SummarySkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <ChartSkeleton height="h-56" />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartSkeleton height="h-56" />
        <ChartSkeleton height="h-56" />
      </div>
      <ChartSkeleton height="h-56" />
    </div>
  );
}
