import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const RepoCardSkeleton = () => (
  <Card className="flex h-full flex-col overflow-hidden">
    <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3">
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-full" />
      </div>
    </CardHeader>
    <CardContent className="flex flex-1 items-end gap-2 pb-4">
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-5 w-20 rounded-full" />
    </CardContent>
    <CardFooter className="border-t bg-muted/30 px-4 py-3">
      <Skeleton className="ml-auto h-8 w-24 rounded-md" />
    </CardFooter>
  </Card>
);
