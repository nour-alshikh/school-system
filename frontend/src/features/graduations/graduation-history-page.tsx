"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Undo2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "@/i18n/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useStaggerIn } from "@/hooks/use-stagger-in";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Pagination, type PageMeta } from "@/components/pagination";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SearchInput } from "@/components/search-input";
import type { Graduation } from "./types";
import type { ClassroomType } from "@/types/generated";

const PER_PAGE = 10;
const ALL = "all";

function nameOf(locale: string, item: { name_en: string; name_ar: string }) {
  return locale === "ar" ? item.name_ar : item.name_en;
}

function formatDate(locale: string, iso: string) {
  return new Date(iso).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function GraduationHistoryPage() {
  const t = useTranslations("GraduationsPage");
  const tTable = useTranslations("Table");
  const locale = useLocale();
  const { user, isLoading: isAuthLoading, can } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const canManage = can("manage-students");

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [classroomFilter, setClassroomFilter] = useState<string>(ALL);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);
  const [selectedRollbackIds, setSelectedRollbackIds] = useState<Set<number>>(
    new Set()
  );
  const [rollbackTargetIds, setRollbackTargetIds] = useState<number[]>([]);
  const [rollbackConfirmOpen, setRollbackConfirmOpen] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login?redirect=/graduations/history");
    }
  }, [isAuthLoading, user, router]);

  useEffect(() => {
    if (!isAuthLoading && user && !canManage) {
      router.replace("/dashboard");
    }
  }, [isAuthLoading, user, canManage, router]);

  // A filter change should jump back to page 1 and drop any selection made
  // on the previous result set — done during render (comparing against the
  // previous committed value) rather than in an effect, so it applies in
  // the same render. Same convention as PromotionHistoryPage.
  const filtersKey = `${search}::${statusFilter}::${classroomFilter}`;
  const [prevFiltersKey, setPrevFiltersKey] = useState(filtersKey);
  if (filtersKey !== prevFiltersKey) {
    setPrevFiltersKey(filtersKey);
    setPage(1);
    setSelectedRollbackIds(new Set());
  }

  const {
    data: historyData,
    isLoading: isLoadingHistory,
    error: historyError,
  } = useQuery({
    queryKey: ["graduations", page, search, statusFilter, classroomFilter],
    queryFn: () =>
      apiFetch<{ graduations: Graduation[]; meta: PageMeta }>(
        `/api/graduations?page=${page}&per_page=${PER_PAGE}&search=${encodeURIComponent(search)}` +
          (statusFilter !== ALL ? `&status=${statusFilter}` : "") +
          (classroomFilter !== ALL ? `&classroom_id=${classroomFilter}` : "")
      ),
    enabled: !isAuthLoading && !!user && canManage,
  });
  const history = historyData?.graduations ?? [];
  const historyMeta = historyData?.meta;

  const { data: classroomsData } = useQuery({
    queryKey: ["classrooms"],
    queryFn: () =>
      apiFetch<{ classrooms: ClassroomType[] }>("/api/classrooms").then(
        (d) => d.classrooms
      ),
    enabled: !isAuthLoading && !!user && canManage,
  });
  const classroomFilterItems = [
    { value: ALL, label: t("statusFilterAll") },
    ...(classroomsData ?? []).map((c) => ({ value: String(c.id), label: c.name })),
  ];

  useEffect(() => {
    if (!historyError) return;
    toast.error(
      historyError instanceof ApiError ? historyError.message : t("loadError")
    );
  }, [historyError, t]);

  const rowsRef = useStaggerIn<HTMLDivElement>({
    selector: "[data-slot='table-body'] [data-slot='table-row']",
    deps: [history.length, page, search, statusFilter, classroomFilter, isLoadingHistory],
  });

  function handlePageChange(newPage: number) {
    setPage(newPage);
    setSelectedRollbackIds(new Set());
  }

  const rollbackableIds = history
    .filter((g) => !g.rolled_back_at)
    .map((g) => g.id);
  const allRollbackSelected =
    rollbackableIds.length > 0 &&
    rollbackableIds.every((id) => selectedRollbackIds.has(id));

  function toggleRollbackRow(id: number, checked: boolean) {
    setSelectedRollbackIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAllRollback(checked: boolean) {
    setSelectedRollbackIds(checked ? new Set(rollbackableIds) : new Set());
  }

  function openRollbackConfirm(ids: number[]) {
    setRollbackTargetIds(ids);
    setRollbackConfirmOpen(true);
  }

  const rollbackMutation = useMutation({
    mutationFn: (graduationIds: number[]) =>
      apiFetch<{ rolled_back_count: number }>("/api/graduations/rollback", {
        method: "POST",
        body: JSON.stringify({ graduation_ids: graduationIds }),
      }),
    onSuccess: (data) => {
      toast.success(t("rollbackSuccessToast", { count: data.rolled_back_count }));
      queryClient.invalidateQueries({ queryKey: ["students"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["graduations"], exact: false });
      setSelectedRollbackIds(new Set());
      setRollbackConfirmOpen(false);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : t("rollbackError"));
      setRollbackConfirmOpen(false);
    },
  });

  if (isAuthLoading || !user || !canManage) {
    return <PageLoader />;
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit"
          onClick={() => router.push("/graduations")}
        >
          <ArrowLeft className="size-4" />
          {t("backToGraduate")}
        </Button>

        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">{t("historyHeading")}</h1>
          {selectedRollbackIds.size > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openRollbackConfirm([...selectedRollbackIds])}
            >
              <Undo2 className="size-4" />
              {t("rollbackSelected", { count: selectedRollbackIds.size })}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder={t("historySearchPlaceholder")}
        />
        <Select
          items={[
            { value: ALL, label: t("statusFilterAll") },
            { value: "active", label: t("activeBadge") },
            { value: "rolled_back", label: t("rolledBackBadge") },
          ]}
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value ?? ALL)}
        >
          <SelectTrigger aria-label={t("statusColumn")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("statusFilterAll")}</SelectItem>
            <SelectItem value="active">{t("activeBadge")}</SelectItem>
            <SelectItem value="rolled_back">{t("rolledBackBadge")}</SelectItem>
          </SelectContent>
        </Select>
        <Select
          items={classroomFilterItems}
          value={classroomFilter}
          onValueChange={(value) => setClassroomFilter(value ?? ALL)}
        >
          <SelectTrigger aria-label={t("classroomFilterLabel")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {classroomFilterItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!isLoadingHistory && history.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {search || statusFilter !== ALL || classroomFilter !== ALL
            ? t("historyNoResults")
            : t("historyEmpty")}
        </p>
      ) : (
        <div ref={rowsRef}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    aria-label={tTable("selectAll")}
                    checked={allRollbackSelected}
                    onCheckedChange={(checked) => toggleAllRollback(!!checked)}
                  />
                </TableHead>
                <TableHead>{t("studentColumn")}</TableHead>
                <TableHead>{t("classColumn")}</TableHead>
                <TableHead>{t("academicYearColumn")}</TableHead>
                <TableHead>{t("graduatedByColumn")}</TableHead>
                <TableHead>{t("dateColumn")}</TableHead>
                <TableHead>{t("statusColumn")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingHistory ? (
                <TableSkeletonRows columns={8} />
              ) : (
                history.map((graduation) => {
                  const isRolledBack = !!graduation.rolled_back_at;
                  return (
                    <TableRow key={graduation.id}>
                      <TableCell>
                        <Checkbox
                          aria-label={tTable("selectRow")}
                          checked={selectedRollbackIds.has(graduation.id)}
                          disabled={isRolledBack}
                          onCheckedChange={(checked) =>
                            toggleRollbackRow(graduation.id, !!checked)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {locale === "ar"
                          ? graduation.student_name_ar
                          : graduation.student_name_en}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {nameOf(locale, graduation.stage)} /{" "}
                        {nameOf(locale, graduation.grade)} /{" "}
                        {graduation.classroom.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {nameOf(locale, graduation.academic_year)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {graduation.graduated_by_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(locale, graduation.created_at)}
                      </TableCell>
                      <TableCell>
                        {isRolledBack ? (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {t("rolledBackBadge")}
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            {t("activeBadge")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            aria-label={t("rollbackOne")}
                            title={t("rollbackOne")}
                            disabled={isRolledBack}
                            onClick={() => openRollbackConfirm([graduation.id])}
                          >
                            <Undo2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {historyMeta && (
        <Pagination meta={historyMeta} onPageChange={handlePageChange} />
      )}

      <ConfirmDialog
        open={rollbackConfirmOpen}
        onOpenChange={setRollbackConfirmOpen}
        title={t("rollbackConfirmTitle")}
        description={t("rollbackConfirmDescription", {
          count: rollbackTargetIds.length,
        })}
        confirmLabel={t("rollbackOne")}
        cancelLabel={t("cancel")}
        isLoading={rollbackMutation.isPending}
        onConfirm={() => rollbackMutation.mutate(rollbackTargetIds)}
      />
    </main>
  );
}
