import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Loading placeholders shaped like the app shell (site-sidebar.tsx,
// site-header.tsx) and its pages, so a reload shows the layout it's about
// to fill instead of a spinner on a blank page.

/** Matches SiteSidebar: brand row, grouped links, footer buttons. */
export function SidebarSkeleton({ collapsed = false }: { collapsed?: boolean }) {
  const groups = [1, 4, 3, 1];

  return (
    <aside
      aria-hidden
      className={cn(
        "sticky top-0 hidden h-svh shrink-0 flex-col border-e border-sidebar-border bg-sidebar print:hidden md:flex",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className={cn("flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border", collapsed ? "justify-center px-2" : "px-4")}>
        <Skeleton className="size-8 rounded-lg bg-primary/25" />
        {!collapsed && (
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        )}
      </div>
      <div className={cn("flex flex-1 flex-col gap-5 overflow-hidden py-4", collapsed ? "px-2" : "px-3")}>
        {groups.map((links, g) => (
          <div key={g} className="flex flex-col gap-1">
            {!collapsed && <Skeleton className="mx-3 mb-1.5 h-2.5 w-16" />}
            {Array.from({ length: links }, (_, i) => (
              <div key={i} className={cn("flex items-center gap-3 rounded-lg py-2", collapsed ? "justify-center" : "px-3", g === 0 && "bg-primary/10")}>
                <Skeleton className={cn("size-4 rounded", g === 0 && "bg-primary/30")} />
                {!collapsed && <Skeleton className="h-3" style={{ width: `${48 + ((g * 3 + i * 5) % 6) * 9}%` }} />}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className={cn("flex shrink-0 flex-col gap-2 border-t border-sidebar-border py-4", collapsed ? "items-center px-2" : "px-6")}>
        <Skeleton className={cn("h-3", collapsed ? "w-4" : "w-28")} />
        <Skeleton className={cn("h-3", collapsed ? "w-4" : "w-16")} />
      </div>
    </aside>
  );
}

/** Matches the signed-in SiteHeader: search box, then icon buttons and the avatar. */
export function HeaderSkeleton() {
  return (
    <header
      aria-hidden
      className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur print:hidden sm:px-4 lg:px-6"
    >
      <Skeleton className="size-8 rounded-md md:hidden" />
      <Skeleton className="h-9 w-full max-w-80 rounded-lg" />
      <div className="ms-auto flex items-center gap-2">
        <Skeleton className="hidden h-9 w-32 rounded-lg sm:block" />
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="size-8 rounded-md" />
        ))}
        <Skeleton className="size-8 rounded-full" />
      </div>
    </header>
  );
}

/** A KpiCard placeholder: icon chip and title, the number, a sparkline strip. */
export function KpiSkeleton({ tone = "teal" }: { tone?: "teal" | "amber" }) {
  return (
    <div className="relative flex h-36 flex-col gap-3 overflow-hidden rounded-xl border bg-card p-4">
      <span className={cn("absolute inset-x-0 top-0 h-0.5", tone === "amber" ? "bg-brand-accent/60" : "bg-primary/50")} />
      <div className="flex items-center gap-2">
        <Skeleton className={cn("size-7 rounded-md", tone === "amber" ? "bg-brand-accent/20" : "bg-primary/15")} />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-7 w-20" />
      <Skeleton className="h-2.5 w-32" />
      <Skeleton className="mt-auto h-6 w-full rounded-sm opacity-60" />
    </div>
  );
}

/** A Panel placeholder: heading, description, then a chart area or list rows. */
export function PanelSkeleton({ className, variant = "chart", rows = 4 }: { className?: string; variant?: "chart" | "list"; rows?: number }) {
  return (
    <div className={cn("flex min-h-80 flex-col gap-4 rounded-xl border bg-card p-4", className)}>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-48" />
      </div>
      {variant === "chart" ? (
        <div className="flex flex-1 items-end gap-2 pt-4">
          {[40, 62, 50, 78, 66, 88, 72, 58, 80, 68].map((h, i) => (
            <Skeleton key={i} className="flex-1 rounded-t-md rounded-b-none" style={{ height: `${h}%` }} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-9 shrink-0 rounded-lg" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3" style={{ width: `${55 + ((i * 17) % 35)}%` }} />
                <Skeleton className="h-2.5 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** The greeting row of a dashboard: title, date line, a couple of actions. */
export function DashboardHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-72 max-w-full" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-44" />
          <Skeleton className="h-5 w-28 rounded-full bg-brand-accent/20" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-32 rounded-lg bg-primary/25" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>
    </div>
  );
}

/** A full dashboard while auth (and so the role) is still unknown. */
export function DashboardSkeleton() {
  return (
    <main aria-busy className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-6">
      <DashboardHeaderSkeleton />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(["teal", "amber", "teal", "amber"] as const).map((tone, i) => (
          <KpiSkeleton key={i} tone={tone} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <PanelSkeleton className="lg:col-span-8" />
        <PanelSkeleton className="lg:col-span-4" variant="list" />
      </div>
    </main>
  );
}

/** A generic list page: title row with an action, then a table card. */
export function PageSkeleton() {
  return (
    <main aria-busy className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-3.5 w-72 max-w-full" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg bg-primary/25" />
      </div>
      <div className="flex flex-col overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center gap-3 border-b p-4">
          <Skeleton className="h-9 w-64 max-w-full rounded-lg" />
          <Skeleton className="ms-auto h-9 w-24 rounded-lg" />
        </div>
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-4 py-3.5 last:border-b-0">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <Skeleton className="h-3.5" style={{ width: `${22 + ((i * 13) % 18)}%` }} />
            <Skeleton className="ms-auto hidden h-3.5 w-24 sm:block" />
            <Skeleton className="hidden h-5 w-16 rounded-full md:block" />
          </div>
        ))}
      </div>
    </main>
  );
}
