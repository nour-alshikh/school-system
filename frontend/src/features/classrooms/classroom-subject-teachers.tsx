"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Subject } from "@/features/subjects/types";
import type { Teacher } from "@/features/teachers/types";

export type SubjectTeacherAssignment = {
  subject_id: number;
  teacher_id: number;
};

/**
 * Per-classroom subject/teacher assignment: one card per subject taught in
 * the classroom's grade, each expanding into a teacher picker scoped to
 * teachers already set up to teach that subject (Teacher::subjects — see
 * TeacherSubjectsPage). Used from both the create and edit classroom forms.
 */
export function ClassroomSubjectTeachers({
  gradeId,
  value,
  onChange,
}: {
  gradeId: string;
  value: SubjectTeacherAssignment[];
  onChange: (value: SubjectTeacherAssignment[]) => void;
}) {
  const t = useTranslations("ClassroomSubjectTeachers");
  const locale = useLocale();
  const [openSubjectId, setOpenSubjectId] = useState<number | null>(null);

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects", "grade", gradeId],
    queryFn: () =>
      apiFetch<{ subjects: Subject[] }>(
        `/api/subjects?grade_id=${gradeId}`
      ).then((d) => d.subjects),
    enabled: !!gradeId,
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers", "all"],
    queryFn: () =>
      apiFetch<{ teachers: Teacher[] }>("/api/teachers").then(
        (d) => d.teachers
      ),
    enabled: !!gradeId,
  });

  if (!gradeId) return null;

  if (subjects.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noSubjects")}</p>;
  }

  const assignedTeacherIdBySubject = new Map(
    value.map((a) => [a.subject_id, a.teacher_id])
  );

  function setAssignment(subjectId: number, teacherId: number | null) {
    const next = value.filter((a) => a.subject_id !== subjectId);
    if (teacherId != null) {
      next.push({ subject_id: subjectId, teacher_id: teacherId });
    }
    onChange(next);
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
      {subjects.map((subject) => {
        const subjectName =
          locale === "ar" ? subject.name_ar : subject.name_en;
        const assignedTeacherId = assignedTeacherIdBySubject.get(subject.id);
        const assignedTeacher = teachers.find(
          (teacher) => teacher.id === assignedTeacherId
        );
        const eligibleTeachers = teachers.filter((teacher) =>
          teacher.subject_ids.includes(subject.id)
        );
        const isOpen = openSubjectId === subject.id;

        return (
          <div
            key={subject.id}
            className={cn(
              "flex flex-col gap-1.5 rounded-lg border p-3 text-sm transition-colors",
              assignedTeacher
                ? "border-primary/40 bg-primary/5"
                : "border-input"
            )}
          >
            <div className="flex items-start justify-between gap-1">
              <button
                type="button"
                className="flex-1 text-left font-medium"
                onClick={() => setOpenSubjectId(isOpen ? null : subject.id)}
              >
                {subjectName}
              </button>
              {assignedTeacher && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="-mt-1 -mr-1 size-6"
                  aria-label={t("clear")}
                  title={t("clear")}
                  onClick={() => setAssignment(subject.id, null)}
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              {assignedTeacher ? assignedTeacher.name : t("unassigned")}
            </p>

            {isOpen &&
              (eligibleTeachers.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t("noEligibleTeachers")}
                </p>
              ) : (
                <Select
                  items={eligibleTeachers.map((teacher) => ({
                    value: String(teacher.id),
                    label: teacher.name,
                  }))}
                  value={
                    assignedTeacherId != null
                      ? String(assignedTeacherId)
                      : undefined
                  }
                  onValueChange={(teacherId) => {
                    setAssignment(subject.id, Number(teacherId));
                    setOpenSubjectId(null);
                  }}
                >
                  <SelectTrigger className="w-full" size="sm">
                    <SelectValue placeholder={t("teacherPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleTeachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={String(teacher.id)}>
                        {teacher.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ))}
          </div>
        );
      })}
    </div>
  );
}
