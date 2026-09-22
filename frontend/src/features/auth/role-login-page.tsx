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
      await login({ ...values, role });
      setRedirecting(true);
      router.push(searchParams.get("redirect") ?? "/dashboard");
      router.refresh();
    } catch (err) {
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

        <Button type="submit" disabled={form.formState.isSubmitting}>
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

export function RoleLoginPage({ role }: { role: LoginRole }) {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Suspense fallback={null}>
        <RoleLoginForm role={role} />
      </Suspense>
    </main>
  );
}
