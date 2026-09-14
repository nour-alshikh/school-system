import { Skeleton } from "@/components/ui/skeleton";

// Generic placeholder for a page's brief pre-auth-resolved state (see
// docs/layout.md — isLoading is true for the whole server-rendered HTML).
// Not meant to mimic any specific page's final layout, just avoid a bare
// "Loading…" flash.
export function PageSkeleton() {
  return (
    <main className="flex flex-1 flex-col gap-4 p-6">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-4 w-52" />
    </main>
  );
}
