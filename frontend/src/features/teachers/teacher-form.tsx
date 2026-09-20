"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { applyServerErrors } from "@/lib/form-errors";
import { cn } from "@/lib/utils";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  createTeacherSchema,
  teacherStatusOptions,
  type TeacherFormValues,
} from "./schema";
import type { Teacher } from "./types";

const cardLabelClass = (selected: boolean) =>
  cn(
    "flex cursor-pointer items-center gap-2 rounded-lg border border-input p-3 text-sm transition-colors hover:bg-muted",
    selected && "border-primary bg-primary/5 hover:bg-primary/5"
  );

const defaultValues: TeacherFormValues = {
  name: "",
  email: "",
  phone: "",
  joining_date: "",
  status: "active",
  password: "",
  password_confirmation: "",
};

function valuesFromTeacher(teacher: Teacher): TeacherFormValues {
  return {
    name: teacher.name,
    email: teacher.email,
    phone: teacher.phone ?? "",
    joining_date: teacher.joining_date,
    status: teacher.status,
    password: "",
    password_confirmation: "",
  };
}

export function TeacherForm({
  teacher,
  onSuccess,
}: {
  teacher?: Teacher;
  onSuccess?: () => void;
}) {
  const t = useTranslations("TeacherForm");
  const tValidation = useTranslations("Validation");
  const tErrors = useTranslations("Errors");
  const queryClient = useQueryClient();

  const statusLabels: Record<(typeof teacherStatusOptions)[number], string> = {
    active: t("statusActiveLabel"),
    inactive: t("statusInactiveLabel"),
    on_leave: t("statusOnLeaveLabel"),
  };

  const schema = useMemo(() => createTeacherSchema(tValidation), [tValidation]);

  const form = useForm<TeacherFormValues>({
    resolver: zodResolver(schema),
    defaultValues: teacher ? valuesFromTeacher(teacher) : defaultValues,
  });

  const mutation = useMutation({
    mutationFn: (values: TeacherFormValues) => {
      const payload = {
        name: values.name,
        email: values.email,
        phone: values.phone || null,
        joining_date: values.joining_date,
        status: values.status,
        password: values.password || undefined,
        password_confirmation: values.password_confirmation || undefined,
      };

      return teacher
        ? apiFetch<{ teacher: Teacher }>(`/api/teachers/${teacher.id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : apiFetch<{ teacher: Teacher }>("/api/teachers", {
            method: "POST",
            body: JSON.stringify(payload),
          });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      toast.success(teacher ? t("updatedToast") : t("createdToast"));
      if (!teacher) form.reset(defaultValues);
      onSuccess?.();
    },
    onError: (err) => {
      const message = applyServerErrors(
        form,
        err,
        ["name", "email", "phone", "joining_date", "status", "password", "password_confirmation"],
        tErrors("somethingWentWrong")
      );
      if (message) toast.error(message);
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        className="flex flex-col gap-4"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("nameLabel")}</FormLabel>
              <FormControl>
                <Input {...field} className="h-10" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("emailLabel")}</FormLabel>
              <FormControl>
                <Input {...field} type="email" dir="ltr" className="h-10" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("phoneLabel")}</FormLabel>
              <FormControl>
                <Input {...field} dir="ltr" className="h-10" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="joining_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("joiningDateLabel")}</FormLabel>
              <FormControl>
                <Input {...field} type="date" className="h-10" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("statusLabel")}</FormLabel>
              <FormControl>
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="grid grid-cols-3 gap-2"
                >
                  {teacherStatusOptions.map((option) => (
                    <label
                      key={option}
                      className={cardLabelClass(field.value === option)}
                    >
                      <RadioGroupItem value={option} />
                      <span>{statusLabels[option]}</span>
                    </label>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col gap-4 rounded-lg border border-input p-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{t("loginSectionLabel")}</span>
            <span className="text-sm text-muted-foreground">
              {teacher?.has_login ? t("loginSectionHasLoginHint") : t("loginSectionNoLoginHint")}
            </span>
          </div>

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {teacher?.has_login ? t("newPasswordLabel") : t("passwordLabel")}
                </FormLabel>
                <FormControl>
                  <Input {...field} type="password" dir="ltr" className="h-10" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password_confirmation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("passwordConfirmationLabel")}</FormLabel>
                <FormControl>
                  <Input {...field} type="password" dir="ltr" className="h-10" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            {teacher ? t("saveChanges") : t("createTeacher")}
          </Button>

          {onSuccess && (
            <Button type="button" variant="outline" onClick={onSuccess}>
              {t("cancel")}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
