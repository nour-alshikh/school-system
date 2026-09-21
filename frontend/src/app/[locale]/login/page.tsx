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
import { createLoginSchema, type LoginPayload } from "@/lib/schemas";
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

function LoginForm() {
  const t = useTranslations("LoginPage");
  const tValidation = useTranslations("Validation");
  const tErrors = useTranslations("Errors");
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Set the instant login() resolves, so the form (which stays mounted
  // until the router finishes swapping routes) doesn't linger on screen
  // alongside the now-authenticated sidebar — see loading.tsx, which
  // doesn't fire here since both routes are plain client components.
  const [redirecting, setRedirecting] = useState(false);

  const schema = useMemo(() => createLoginSchema(tValidation), [tValidation]);

  const form = useForm<LoginPayload>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginPayload) {
    try {
      await login(values);
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

  // No <main> here — the LoginPage wrapper below already provides and
  // centers one; nesting PageLoader's own <main> inside it would be
  // invalid HTML.
  if (redirecting) {
    return <Loader2 className="size-6 animate-spin text-muted-foreground" />;
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="w-full max-w-sm flex flex-col gap-4"
      >
        <h1 className="text-xl font-semibold">{t("heading")}</h1>

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
          {t("noAccount")}{" "}
          <Link href="/register" className="underline">
            {t("registerLink")}
          </Link>
        </p>
      </form>
    </Form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
