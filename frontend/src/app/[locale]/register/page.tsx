"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { applyServerErrors } from "@/lib/form-errors";
import { Loader2 } from "lucide-react";
import { createRegisterSchema, type RegisterPayload } from "@/lib/schemas";
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

export default function RegisterPage() {
  const t = useTranslations("RegisterPage");
  const tValidation = useTranslations("Validation");
  const tErrors = useTranslations("Errors");
  const { register: registerUser } = useAuth();
  const router = useRouter();
  // See login/page.tsx's redirecting state for why this is needed.
  const [redirecting, setRedirecting] = useState(false);

  const schema = useMemo(
    () => createRegisterSchema(tValidation),
    [tValidation]
  );

  const form = useForm<RegisterPayload>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      password_confirmation: "",
    },
  });

  async function onSubmit(values: RegisterPayload) {
    try {
      await registerUser(values);
      setRedirecting(true);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      const message = applyServerErrors(
        form,
        err,
        ["name", "email", "password", "password_confirmation"],
        tErrors("somethingWentWrong")
      );
      if (message) toast.error(message);
    }
  }

  if (redirecting) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-full max-w-sm flex flex-col gap-4"
        >
          <h1 className="text-xl font-semibold">{t("heading")}</h1>

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("nameLabel")}</FormLabel>
                <FormControl>
                  <Input type="text" autoComplete="name" {...field} />
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
                    autoComplete="new-password"
                    {...field}
                  />
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
                  <Input
                    type="password"
                    autoComplete="new-password"
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
            {t("haveAccount")}{" "}
            <Link href="/login" className="underline">
              {t("loginLink")}
            </Link>
          </p>

          <p className="text-sm text-center">
            {t("settingUpSchool")}{" "}
            <Link href="/create-school" className="underline">
              {t("createSchoolLink")}
            </Link>
          </p>
        </form>
      </Form>
    </main>
  );
}
