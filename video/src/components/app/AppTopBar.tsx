import { Bell, Languages, Moon, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The app's top bar (site-header.tsx): search on the start side, then the
 * assistant ✦, notifications, theme, language and the user menu. Same
 * classes; the dropdowns are drawn closed. `assistantActive` shows the ✦
 * button pressed, as when the panel is open.
 */
export function AppTopBar({ assistantActive = false, initials = "DA" }: { assistantActive?: boolean; initials?: string }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-4">
      <div className="inline-flex h-9 w-56 items-center gap-2 rounded-lg border bg-background px-3 text-sm text-muted-foreground">
        <Search className="size-4" />
        <span className="flex-1">Search…</span>
        <kbd className="rounded border bg-muted px-1.5 text-[10px] font-medium">Ctrl K</kbd>
      </div>
      <div className="ms-auto flex items-center gap-1 sm:gap-2">
        <Button variant="ghost" size="icon" className={cn(assistantActive && "bg-muted")}>
          <Sparkles className="size-4 text-brand-accent-strong" />
        </Button>
        <Button variant="ghost" size="icon">
          <Bell className="size-4" />
        </Button>
        <Button variant="ghost" size="icon">
          <Moon className="size-4" />
        </Button>
        <Button variant="ghost" size="icon">
          <Languages className="size-4" />
        </Button>
        <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{initials}</span>
      </div>
    </header>
  );
}
