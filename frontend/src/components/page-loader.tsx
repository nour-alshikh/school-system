import { Loader2 } from "lucide-react";

// Generic placeholder for a page's brief pre-auth-resolved state (see
// docs/layout.md — isLoading is true for the whole server-rendered HTML).
// A centered spinner rather than a skeleton — there's no known layout yet to
// mimic at this point, since auth hasn't resolved to a page shape.
export function PageLoader() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </main>
  );
}
