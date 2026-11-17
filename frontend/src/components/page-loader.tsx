import { PageSkeleton } from "@/components/app-skeletons";

// Placeholder for a page's brief pre-auth-resolved state (see
// docs/layout.md — isLoading is true for the whole server-rendered HTML).
// A generic title + table skeleton in the new layout's shape; pages with a
// known shape (the dashboard) use their own.
export function PageLoader() {
  return <PageSkeleton />;
}
