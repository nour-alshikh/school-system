"use client";

import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { CornerDownLeft, Search, UserRound } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { StudentType } from "@/types/generated";
import { flattenSections, useNavSections } from "@/components/app-nav";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const noopSubscribe = () => () => {};

/** ⌘ on Apple keyboards, Ctrl elsewhere. False on the server. */
export function useIsMac() {
  return useSyncExternalStore(
    noopSubscribe,
    () => /Mac|iPhone|iPad/.test(navigator.userAgent),
    () => false
  );
}

interface Result {
  key: string;
  href: string;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * The top bar's search: jumps to any page in this user's navigation and,
 * for staff who manage students, to a student by name or email. Opens with
 * ⌘K / Ctrl K from anywhere.
 */
export function CommandMenu() {
  const t = useTranslations("Nav");
  const locale = useLocale();
  const router = useRouter();
  const { can } = useAuth();
  const isMac = useIsMac();
  const listId = useId();
  const { sections } = useNavSections();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const debounced = useDebouncedValue(query.trim(), 250);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const searchStudents = can("manage-students") && debounced.length >= 2;
  const { data: students, isFetching } = useQuery({
    queryKey: ["command-menu-students", debounced],
    queryFn: () =>
      apiFetch<{ students: StudentType[] }>(
        `/api/students?page=1&per_page=5&search=${encodeURIComponent(debounced)}`
      ).then((d) => d.students),
    enabled: open && searchStudents,
    staleTime: 30 * 1000,
  });

  const pages = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale);
    return flattenSections(sections)
      .filter((item, index, all) => all.findIndex((other) => other.href === item.href) === index)
      .filter(
        (item) =>
          !needle ||
          [item.label, item.group ?? "", item.section].some((text) => text.toLocaleLowerCase(locale).includes(needle))
      )
      .map<Result>((item) => ({
        key: `page:${item.href}`,
        href: item.href,
        label: item.label,
        hint: item.group ? `${item.section} · ${item.group}` : item.section,
        icon: item.icon,
      }));
  }, [sections, query, locale]);

  const studentResults = useMemo<Result[]>(
    () =>
      searchStudents && students
        ? students.map((s) => ({
            key: `student:${s.id}`,
            href: `/students/${s.id}`,
            label: locale === "ar" ? s.name_ar : s.name_en,
            hint: s.email,
            icon: UserRound,
          }))
        : [],
    [searchStudents, students, locale]
  );

  const groups = [
    { key: "pages", label: t("searchPages"), results: pages },
    { key: "students", label: t("searchStudents"), results: studentResults },
  ]
    .filter((g) => g.results.length > 0)
    .map((g, i, all) => ({ ...g, start: all.slice(0, i).reduce((n, other) => n + other.results.length, 0) }));
  const results = groups.flatMap((g) => g.results);
  const activeIndex = Math.min(active, Math.max(results.length - 1, 0));

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setActive(0);
    }
  }

  function go(result: Result) {
    onOpenChange(false);
    router.push(result.href);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((activeIndex + 1) % Math.max(results.length, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((activeIndex - 1 + results.length) % Math.max(results.length, 1));
    } else if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      go(results[activeIndex]);
    }
  }

  const shortcut = isMac ? "⌘K" : "Ctrl K";
  const placeholder = can("manage-students") ? t("searchPlaceholder") : t("searchPagesPlaceholder");
  const optionId = (index: number) => `${listId}-option-${index}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("search")}
        aria-keyshortcuts={isMac ? "Meta+K" : "Control+K"}
        className="flex h-9 items-center gap-2 rounded-lg border bg-muted/40 px-2.5 text-sm text-muted-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-64 sm:px-3 lg:w-80"
      >
        <Search className="size-4 shrink-0" />
        <span className="hidden flex-1 truncate text-start sm:inline">{placeholder}</span>
        <kbd
          dir="ltr"
          className="hidden rounded border bg-background px-1.5 py-0.5 font-sans text-[10px] font-medium sm:inline"
        >
          {shortcut}
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="top-[12%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg"
        >
          <DialogTitle className="sr-only">{t("search")}</DialogTitle>
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onInputKeyDown}
              placeholder={placeholder}
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={results.length ? optionId(activeIndex) : undefined}
              aria-autocomplete="list"
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div id={listId} role="listbox" aria-label={t("search")} className="max-h-[min(60vh,24rem)] overflow-y-auto p-2">
            {results.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                {searchStudents && isFetching ? t("searching") : t("searchNoResults")}
              </p>
            ) : (
              groups.map((group) => (
                <div key={group.key} role="group" aria-label={group.label} className="mb-1 last:mb-0">
                  <div className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">{group.label}</div>
                  {group.results.map((result, offset) => {
                    const i = group.start + offset;
                    const Icon = result.icon;
                    const selected = i === activeIndex;
                    return (
                      <div
                        key={result.key}
                        id={optionId(i)}
                        role="option"
                        aria-selected={selected}
                        onMouseMove={() => setActive(i)}
                        onClick={() => go(result)}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm",
                          selected && "bg-primary/10 text-primary dark:bg-muted dark:text-foreground"
                        )}
                      >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-background">
                          <Icon className="size-3.5" />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate font-medium">{result.label}</span>
                          <span className="truncate text-xs text-muted-foreground" dir="auto">
                            {result.hint}
                          </span>
                        </span>
                        {selected && <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" />}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
