"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, ExternalLink } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { useStaggerIn } from "@/hooks/use-stagger-in";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageLoader } from "@/components/page-loader";
import { TableSkeletonRows } from "@/components/table-skeleton";
import type { LibraryResource } from "./types";
import {
  useParentChildren,
  useSelectedChild,
  withStudent,
} from "@/features/parent-children/use-parent-children";
import { ChildPicker } from "@/features/parent-children/child-picker";

export function ParentLibraryPage() {
  const t = useTranslations("ParentLibraryPage");
  const locale = useLocale();
  const { user, isLoading: isAuthLoading, hasRole } = useAuth();
  const router = useRouter();
  const [subjectFilter, setSubjectFilter] = useState<string>("all");

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login?redirect=/parent-library");
    }
  }, [isAuthLoading, user, router]);

  useEffect(() => {
    if (!isAuthLoading && user && !hasRole("parent")) {
      router.replace("/dashboard");
    }
  }, [isAuthLoading, user, hasRole, router]);

  const isParent = !isAuthLoading && !!user && hasRole("parent");
  const { data: children } = useParentChildren(isParent);
  const { selectedId, select } = useSelectedChild(children);

  const {
    data: resources = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["parent-library-resources", selectedId],
    queryFn: () =>
      apiFetch<{ library_resources: LibraryResource[] }>(
        withStudent("/api/parent/library-resources", selectedId!)
      ).then((d) => d.library_resources),
    enabled: isParent && selectedId !== undefined,
  });

  useEffect(() => {
    if (!error) return;
    toast.error(error instanceof ApiError ? error.message : t("loadError"));
  }, [error, t]);

  const subjects = useMemo(() => {
    const map = new Map<number, { id: number; name_en: string; name_ar: string }>();
    resources.forEach((r) => r.subjects.forEach((s) => map.set(s.id, s)));
    return Array.from(map.values());
  }, [resources]);

  const filtered = useMemo(
    () =>
      subjectFilter === "all"
        ? resources
        : resources.filter((r) => r.subjects.some((s) => String(s.id) === subjectFilter)),
    [resources, subjectFilter]
  );

  const rowsRef = useStaggerIn<HTMLDivElement>({
    selector: "[data-slot='table-body'] [data-slot='table-row']",
    deps: [filtered.length, isLoading],
  });

  if (isAuthLoading || !user) {
    return <PageLoader />;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("heading")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>

        <ChildPicker
          childList={children ?? []}
          selectedId={selectedId}
          onSelect={select}
        />

        {subjects.length > 0 && (
          <Select
            items={[
              { value: "all", label: t("allSubjects") },
              ...subjects.map((s) => ({
                value: String(s.id),
                label: locale === "ar" ? s.name_ar : s.name_en,
              })),
            ]}
            value={subjectFilter}
            onValueChange={(value) => setSubjectFilter(value ?? "all")}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allSubjects")}</SelectItem>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {locale === "ar" ? s.name_ar : s.name_en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {!isLoading && filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noResources")}</p>
        ) : (
          <div ref={rowsRef}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("titleColumn")}</TableHead>
                  <TableHead>{t("subjectsColumn")}</TableHead>
                  <TableHead className="text-end">{t("actionsColumn")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableSkeletonRows columns={3} />
                ) : (
                  filtered.map((resource) => (
                    <TableRow key={resource.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{resource.title}</span>
                          {resource.description && (
                            <span className="text-xs text-muted-foreground">
                              {resource.description}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {resource.subjects.map((subject) => (
                            <span
                              key={subject.id}
                              className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                            >
                              {locale === "ar" ? subject.name_ar : subject.name_en}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-end">
                        {resource.type === "link" ? (
                          <Button
                            nativeButton={false}
                            variant="ghost"
                            size="icon"
                            aria-label={t("openLink")}
                            title={t("openLink")}
                            render={
                              <a href={resource.url ?? "#"} target="_blank" rel="noreferrer" />
                            }
                          >
                            <ExternalLink className="size-4" />
                          </Button>
                        ) : (
                          resource.file && (
                            <Button
                              nativeButton={false}
                              variant="ghost"
                              size="icon"
                              aria-label={t("download")}
                              title={t("download")}
                              render={
                                <a
                                  href={`/api/library-resources/${resource.id}/download`}
                                  download
                                />
                              }
                            >
                              <Download className="size-4" />
                            </Button>
                          )
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </main>
  );
}
