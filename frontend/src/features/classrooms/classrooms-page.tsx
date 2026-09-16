"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useStaggerIn } from "@/hooks/use-stagger-in";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageLoader } from "@/components/page-loader";
import { SearchInput } from "@/components/search-input";
import { ClassroomForm } from "./classroom-form";
import { ClassroomsBulkForm } from "./classrooms-bulk-form";
import { ClassroomStageSection } from "./classroom-stage-section";
import type { Classroom } from "./types";
import type { Grade } from "@/features/grades/types";
import type { Stage } from "@/features/stages/types";

export function ClassroomsPage() {
  const t = useTranslations("ClassroomsPage");
  const locale = useLocale();
  const { user, isLoading: isAuthLoading, can } = useAuth();
  const router = useRouter();

  const canManage = can("manage-academics");

  const [createOpen, setCreateOpen] = useState(false);
  const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(
    null
  );
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login?redirect=/classrooms");
    }
  }, [isAuthLoading, user, router]);

  const {
    data: stages = [],
    isLoading: isLoadingStages,
    error: stagesError,
  } = useQuery({
    queryKey: ["stages"],
    queryFn: () =>
      apiFetch<{ stages: Stage[] }>("/api/stages").then((d) => d.stages),
    enabled: !isAuthLoading && !!user,
  });

  const { data: grades = [] } = useQuery({
    queryKey: ["grades"],
    queryFn: () =>
      apiFetch<{ grades: Grade[] }>("/api/grades").then((d) => d.grades),
    enabled: !isAuthLoading && !!user,
  });

  const stageListRef = useStaggerIn<HTMLDivElement>({
    selector: "[data-animate='stage-section']",
    deps: [stages.length],
  });

  const gradeNameById = new Map(
    grades.map((grade) => [
      grade.id,
      locale === "ar" ? grade.name_ar : grade.name_en,
    ])
  );

  useEffect(() => {
    if (!stagesError) return;

    toast.error(
      stagesError instanceof ApiError ? stagesError.message : t("loadError")
    );
  }, [stagesError, t]);

  if (isAuthLoading || !user) {
    return <PageLoader />;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-6">
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("classroomsHeading")}</h2>
          {canManage && (
            <Button
              type="button"
              size="sm"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" />
              {t("newClassrooms")}
            </Button>
          )}
        </div>

        <SearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder={t("searchPlaceholder")}
        />

        {!isLoadingStages && stages.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noStagesYet")}</p>
        ) : (
          <div ref={stageListRef} className="flex flex-col gap-2">
            {stages.map((stage) => (
              <ClassroomStageSection
                key={stage.id}
                stage={stage}
                search={search}
                canManage={canManage}
                gradeNameById={gradeNameById}
                onEdit={setEditingClassroom}
              />
            ))}
          </div>
        )}
      </section>

      {canManage && (
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("newClassrooms")}</DialogTitle>
            </DialogHeader>
            <ClassroomsBulkForm onSuccess={() => setCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      )}

      {canManage && (
        <Dialog
          open={!!editingClassroom}
          onOpenChange={(open) => !open && setEditingClassroom(null)}
        >
          <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("editClassroom")}</DialogTitle>
            </DialogHeader>
            {editingClassroom && (
              <ClassroomForm
                key={editingClassroom.id}
                classroom={editingClassroom}
                onSuccess={() => setEditingClassroom(null)}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </main>
  );
}
