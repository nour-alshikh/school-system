"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { applyServerErrors } from "@/lib/form-errors";
import {
  createResetPasswordFormSchema,
  type ResetPasswordFormValues,
  type ResetPasswordPayload,
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

function ResetPasswordForm() {
  const t = useTranslations("ResetPasswordPage");
  const tValidation = useTranslations("Validation");
  const tErrors = useTranslations("Errors");
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";

  const schema = useMemo(
    () => createResetPasswordFormSchema(tValidation),
    [tValidation]
  );

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", password_confirmation: "" },
  });

  async function onSubmit(values: ResetPasswordFormValues) {
    try {
      await apiFetch<{ message: string }>("/api/reset-password", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          token,
          email,
        } satisfies ResetPasswordPayload),
      });
      router.push("/login");
    } catch (err) {
      const message = applyServerErrors(
        form,
        err,
        ["password", "password_confirmation"],
        tErrors("somethingWentWrong")
      );
      if (message) toast.error(message);
    }
  }

  if (!token || !email) {
    return (
      <p className="text-sm text-destructive">
        {t("invalidLink")}{" "}
        <Link href="/forgot-password" className="underline">
          {t("requestNew")}
        </Link>
        .
      </p>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="w-full max-w-sm flex flex-col gap-4"
      >
        <h1 className="text-xl font-semibold">{t("heading")}</h1>
        <p className="text-sm text-muted-foreground">{email}</p>

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("newPasswordLabel")}</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
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
              <FormLabel>{t("confirmPasswordLabel")}</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t("submitting") : t("submit")}
        </Button>
      </form>
    </Form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
