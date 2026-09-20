"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { useStaggerIn } from "@/hooks/use-stagger-in";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
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
import {
  attendanceStatusOptions,
  createAttendanceSchema,
  type AttendanceFormValues,
} from "./schema";
import type { AttendanceRosterEntry, AttendanceStatus } from "./types";
import type { Classroom } from "@/features/classrooms/types";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AttendancePage() {
  const t = useTranslations("AttendancePage");
  const tValidation = useTranslations("Validation");
  const tErrors = useTranslations("Errors");
  const locale = useLocale();
  const { user, isLoading: isAuthLoading, can, hasRole } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const canAccess = can("manage-attendance") || hasRole("teacher");

  const [classroomId, setClassroomId] = useState<string>("");
  const [date, setDate] = useState<string>(today());

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login?redirect=/attendance");
    }
  }, [isAuthLoading, user, router]);

  const {
    data: classrooms = [],
    isLoading: isLoadingClassrooms,
    error: classroomsError,
  } = useQuery({
    queryKey: ["attendance-classrooms"],
    queryFn: () =>
      apiFetch<{ classrooms: Classroom[] }>("/api/attendance/classrooms").then(
        (d) => d.classrooms
      ),
    enabled: !isAuthLoading && !!user && canAccess,
  });

  useEffect(() => {
    if (!classroomsError) return;
    toast.error(
      classroomsError instanceof ApiError ? classroomsError.message : t("loadError")
    );
  }, [classroomsError, t]);

  // A single-classroom teacher never has to touch the picker at all — falls
  // back to their one classroom until they (or an admin with more than one)
  // pick something else.
  const effectiveClassroomId =
    classroomId || (classrooms.length === 1 ? String(classrooms[0].id) : "");

  const {
    data: roster,
    isLoading: isLoadingRoster,
    error: rosterError,
  } = useQuery({
    queryKey: ["attendance-roster", effectiveClassroomId, date],
    queryFn: () =>
      apiFetch<{ roster: AttendanceRosterEntry[] }>(
        `/api/classrooms/${effectiveClassroomId}/attendance?date=${date}`
      ).then((d) => d.roster),
    enabled: !!effectiveClassroomId && !!date,
  });

  useEffect(() => {
    if (!rosterError) return;
    toast.error(
      rosterError instanceof ApiError ? rosterError.message : t("rosterLoadError")
    );
  }, [rosterError, t]);

  const schema = useMemo(() => createAttendanceSchema(tValidation), [tValidation]);

  const form = useForm<AttendanceFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { rows: [] },
  });

  const { fields, replace } = useFieldArray({
    control: form.control,
    name: "rows",
  });

  // Every student defaults to "present" unless a record already exists for
  // this date — most days most students show up, so flipping the
  // exceptions is faster than marking everyone by hand.
  useEffect(() => {
    if (!roster) return;
    replace(
      roster.map((entry) => ({
        student_id: entry.student_id,
        status: entry.status ?? "present",
        notes: entry.notes ?? "",
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster]);

  const studentNames = new Map(
    (roster ?? []).map((entry) => [
      entry.student_id,
      locale === "ar" ? entry.student_name_ar : entry.student_name_en,
    ])
  );

  const statusLabels: Record<AttendanceStatus, string> = {
    present: t("statusPresent"),
    absent: t("statusAbsent"),
    late: t("statusLate"),
    excused: t("statusExcused"),
  };

  const mutation = useMutation({
    mutationFn: (values: AttendanceFormValues) =>
      apiFetch<{ saved_count: number }>(
        `/api/classrooms/${effectiveClassroomId}/attendance`,
        {
          method: "POST",
          body: JSON.stringify({
            date,
            records: values.rows.map((row) => ({
              student_id: row.student_id,
              status: row.status,
              notes: row.notes || null,
            })),
          }),
        }
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["attendance-roster", effectiveClassroomId, date],
      });
      toast.success(t("savedToast", { count: data.saved_count }));
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError ? err.message : tErrors("somethingWentWrong")
      );
    },
  });

  const rowsRef = useStaggerIn<HTMLDivElement>({
    selector: "[data-slot='table-body'] [data-slot='table-row']",
    deps: [fields.length, isLoadingRoster],
  });

  if (isAuthLoading || !user) {
    return <PageLoader />;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-6">
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("heading")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            items={classrooms.map((c) => ({ value: String(c.id), label: c.name }))}
            value={effectiveClassroomId}
            onValueChange={(value) => setClassroomId(value ?? "")}
            disabled={isLoadingClassrooms || classrooms.length === 0}
          >
            <SelectTrigger aria-label={t("classroomLabel")} className="w-48">
              <SelectValue placeholder={t("classroomPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {classrooms.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 w-40"
            aria-label={t("dateLabel")}
          />
        </div>

        {!isLoadingClassrooms && classrooms.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("noClassrooms")}</p>
        )}

        {effectiveClassroomId && (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
              className="flex flex-col gap-4"
            >
              <div ref={rowsRef}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("studentColumn")}</TableHead>
                      <TableHead>{t("statusColumn")}</TableHead>
                      <TableHead>{t("notesColumn")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingRoster ? (
                      <TableSkeletonRows columns={3} />
                    ) : fields.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-sm text-muted-foreground">
                          {t("noStudents")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      fields.map((rowField, index) => (
                        <TableRow key={rowField.id}>
                          <TableCell>
                            {studentNames.get(rowField.student_id) ?? rowField.student_id}
                          </TableCell>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`rows.${index}.status`}
                              render={({ field }) => (
                                <FormItem>
                                  <Select
                                    items={attendanceStatusOptions.map((option) => ({
                                      value: option,
                                      label: statusLabels[option],
                                    }))}
                                    value={field.value}
                                    onValueChange={field.onChange}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="w-36">
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {attendanceStatusOptions.map((option) => (
                                        <SelectItem key={option} value={option}>
                                          {statusLabels[option]}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`rows.${index}.notes`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder={t("notesPlaceholder")}
                                      className="h-10 w-48"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {fields.length > 0 && (
                <div className="flex gap-2">
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    {t("saveAttendance")}
                  </Button>
                </div>
              )}
            </form>
          </Form>
        )}
      </section>
    </main>
  );
}
