"use client";

import { useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/contexts/auth-context";
import { isPlatformSession } from "@/lib/platform";
import { apiFetch, ApiError } from "@/lib/api";
import { applyServerErrors } from "@/lib/form-errors";
import type { PlatformSchoolType } from "@/types/generated";
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
import { createSchoolSchema, type SchoolFormValues } from "./schema";

const QUERY_KEY = ["platform", "schools"];

const FORM_FIELDS = ["name", "slug", "admin_name", "admin_email"] as const;

function CreateSchoolForm() {
  const t = useTranslations("PlatformSchoolsPage");
  const tValidation = useTranslations("Validation");
  const tErrors = useTranslations("Errors");
  const queryClient = useQueryClient();

  const schema = useMemo(() => createSchoolSchema(tValidation), [tValidation]);

  const form = useForm<SchoolFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", slug: "", admin_name: "", admin_email: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: SchoolFormValues) =>
      apiFetch<{ school: PlatformSchoolType; admin_invited: boolean }>(
        "/api/platform/schools",
        { method: "POST", body: JSON.stringify(values) }
      ),
    onSuccess: (data, values) => {
      toast.success(
        data.admin_invited
          ? t("createdInvited", { email: values.admin_email })
          : t("createdExisting", { email: values.admin_email })
      );
      form.reset();
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (err) => {
      const message = applyServerErrors(
        form,
        err,
        FORM_FIELDS,
        tErrors("somethingWentWrong")
      );
      if (message) toast.error(message);
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2"
      >
        <h2 className="text-base font-semibold sm:col-span-2">
          {t("newSchool")}
        </h2>

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("nameLabel")}</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("slugLabel")}</FormLabel>
              <FormControl>
                <Input dir="ltr" placeholder="green-valley" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="admin_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("adminNameLabel")}</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="admin_email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("adminEmailLabel")}</FormLabel>
              <FormControl>
                <Input type="email" dir="ltr" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <p className="text-sm text-muted-foreground sm:col-span-2">
          {t("adminHint")}
        </p>

        <div className="sm:col-span-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? t("creating") : t("create")}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export function PlatformSchoolsPage() {
  const t = useTranslations("PlatformSchoolsPage");
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const isAuthorized = isPlatformSession(user);

  useEffect(() => {
    if (!isAuthLoading && (!user || !isAuthorized)) {
      router.replace("/dashboard");
    }
  }, [isAuthLoading, user, isAuthorized, router]);

  const {
    data: schools = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () =>
      apiFetch<{ schools: PlatformSchoolType[] }>("/api/platform/schools").then(
        (data) => data.schools
      ),
    // The API is the real check; this just avoids a guaranteed 403.
    enabled: !isAuthLoading && isAuthorized,
  });

  useEffect(() => {
    if (!error) return;
    toast.error(error instanceof ApiError ? error.message : t("loadError"));
  }, [error, t]);

  if (isAuthLoading || !user || !isAuthorized) {
    return <PageLoader />;
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t("heading")}</h1>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>

      <CreateSchoolForm />

      {error ? (
        <p className="text-sm text-muted-foreground">{t("loadError")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("nameColumn")}</TableHead>
              <TableHead>{t("slugColumn")}</TableHead>
              <TableHead>{t("membersColumn")}</TableHead>
              <TableHead>{t("statusColumn")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeletonRows columns={5} />
            ) : (
              schools.map((school) => {
                const suspended = school.status === "suspended";

                return (
                  <TableRow key={school.id}>
                    <TableCell>
                      {school.name}
                    </TableCell>
                    <TableCell dir="ltr">{school.slug}</TableCell>
                    <TableCell>{school.members_count}</TableCell>
                    <TableCell>
                      {school.status === "archived"
                        ? t("statusArchived")
                        : suspended
                          ? t("statusSuspended")
                          : t("statusActive")}
                    </TableCell>
                    <TableCell className="text-end">
                      {/* Suspending, archiving and exporting (with a
                          reason) are on the school's own page. */}
                      <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/platform/schools/${school.id}`} />}>
                        {t("manage")}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
