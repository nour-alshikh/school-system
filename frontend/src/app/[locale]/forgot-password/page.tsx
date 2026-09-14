"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { applyServerErrors } from "@/lib/form-errors";
import {
  createForgotPasswordSchema,
  type ForgotPasswordPayload,
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

export default function ForgotPasswordPage() {
  const t = useTranslations("ForgotPasswordPage");
  const tValidation = useTranslations("Validation");
  const tErrors = useTranslations("Errors");
  const [message, setMessage] = useState<string | null>(null);

  const schema = useMemo(
    () => createForgotPasswordSchema(tValidation),
    [tValidation]
  );

  const form = useForm<ForgotPasswordPayload>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordPayload) {
    try {
      const data = await apiFetch<{ message: string }>(
        "/api/forgot-password",
        {
          method: "POST",
          body: JSON.stringify(values),
        }
      );
      setMessage(data.message);
    } catch (err) {
      const message = applyServerErrors(
        form,
        err,
        ["email"],
        tErrors("somethingWentWrong")
      );
      if (message) toast.error(message);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-full max-w-sm flex flex-col gap-4"
        >
          <h1 className="text-xl font-semibold">{t("heading")}</h1>

          {message ? (
            <p className="text-sm text-muted-foreground">{message}</p>
          ) : (
            <>
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

              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? t("submitting") : t("submit")}
              </Button>
            </>
          )}

          <p className="text-sm text-center">
            <Link href="/login" className="underline">
              {t("backToLogin")}
            </Link>
          </p>
        </form>
      </Form>
    </main>
  );
}
