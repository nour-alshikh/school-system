"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { applyServerErrors } from "@/lib/form-errors";
import { ApiError } from "@/lib/api";
import type { SchoolMembershipType } from "@/types/generated";
import { Loader2 } from "lucide-react";
import {
  createLoginSchema,
  type LoginFormValues,
  type LoginRole,
} from "@/lib/schemas";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const headingKeys: Record<LoginRole, string> = {
  admin: "headingAdmin",
  teacher: "headingTeacher",
  student: "headingStudent",
  parent: "headingParent",
};

function RoleLoginForm({ role }: { role: LoginRole }) {
  const t = useTranslations("LoginPage");
  const tValidation = useTranslations("Validation");
  const tErrors = useTranslations("Errors");
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  // See the previous single-form login page for why this exists: it keeps
  // the form from lingering on screen once the router starts swapping
  // routes into the now-authenticated sidebar.
  const [redirecting, setRedirecting] = useState(false);
  // Set when the account has this role at more than one school: the backend
  // answers with the schools to choose from, and the next submit sends the
  // chosen school_id along with the same credentials.
  const [schools, setSchools] = useState<SchoolMembershipType[] | null>(null);
  const [schoolId, setSchoolId] = useState("");

  const schema = useMemo(() => createLoginSchema(tValidation), [tValidation]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginFormValues) {
    try {
      // `role` is fixed by which page rendered this form, never a field the
      // user can edit — the backend re-checks it against the account's
      // actual role, so this just makes sure a student's credentials can't
      // be used to log into the teacher form, etc.
      await login({
        ...values,
        role,
        ...(schoolId ? { school_id: Number(schoolId) } : {}),
      });
      setRedirecting(true);
      router.push(searchParams.get("redirect") ?? "/dashboard");
      router.refresh();
    } catch (err) {
      const choices = schoolChoices(err);
      if (choices) {
        setSchools(choices);
        return;
      }

      const message = applyServerErrors(
        form,
        err,
        ["email", "password"],
        tErrors("somethingWentWrong")
      );
      if (message) toast.error(message);
    }
  }

  if (redirecting) {
    return <Loader2 className="size-6 animate-spin text-muted-foreground" />;
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="w-full max-w-sm flex flex-col gap-4"
      >
        <h1 className="text-xl font-semibold">{t(headingKeys[role])}</h1>

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("emailLabel")}</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("passwordLabel")}</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="current-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {schools && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="login-school">{t("schoolLabel")}</Label>
            <Select
              items={schools.map((s) => ({
                value: String(s.school_id),
                label: s.school_name,
              }))}
              value={schoolId}
              onValueChange={(value) => setSchoolId(value ?? "")}
            >
              <SelectTrigger id="login-school" className="w-full">
                <SelectValue placeholder={t("schoolPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {schools.map((s) => (
                  <SelectItem key={s.school_id} value={String(s.school_id)}>
                    {s.school_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">{t("schoolHint")}</p>
          </div>
        )}

        <Button
          type="submit"
          disabled={form.formState.isSubmitting || (!!schools && !schoolId)}
        >
          {form.formState.isSubmitting ? t("submitting") : t("submit")}
        </Button>

        <p className="text-sm text-center">
          <Link href="/forgot-password" className="underline">
            {t("forgotPassword")}
          </Link>
        </p>

        <p className="text-sm text-center">
          <Link href="/login" className="underline">
            {t("backToChooser")}
          </Link>
        </p>
      </form>
    </Form>
  );
}

/** The schools to pick from, when a login failed only because it was ambiguous. */
function schoolChoices(err: unknown): SchoolMembershipType[] | null {
  if (!(err instanceof ApiError) || err.status !== 422) return null;

  const schools = (err.data as { schools?: SchoolMembershipType[] } | undefined)
    ?.schools;

  return Array.isArray(schools) && schools.length > 0 ? schools : null;
}

export function RoleLoginPage({ role }: { role: LoginRole }) {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Suspense fallback={null}>
        <RoleLoginForm role={role} />
      </Suspense>
    </main>
  );
}
