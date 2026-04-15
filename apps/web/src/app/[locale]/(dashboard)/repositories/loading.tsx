import { Skeleton } from "@/components/ui/skeleton";

const SkeletonCard = () => (
  <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
    <Skeleton className="h-4 w-2/3" />
    <Skeleton className="h-3 w-full" />
    <Skeleton className="h-3 w-3/4" />
    <div className="mt-2 flex gap-2">
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-5 w-20 rounded-full" />
    </div>
    <Skeleton className="mt-4 h-8 w-24 self-end rounded-lg" />
  </div>
);

export default function RepositoriesLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <div>
        <Skeleton className="mb-4 h-6 w-40" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
      <div>
        <Skeleton className="mb-4 h-6 w-40" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
