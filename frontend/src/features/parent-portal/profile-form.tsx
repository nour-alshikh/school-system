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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Section } from "@/features/students/guardian-fields";
import { createProfileSchema, type ProfileValues } from "./schema";
import type { User } from "@/types/auth";

const KNOWN_FIELDS = ["name", "email", "password", "password_confirmation"] as const;

export function ProfileForm({ user }: { user: User }) {
  const t = useTranslations("ParentPortal");
  const tValidation = useTranslations("Validation");
  const queryClient = useQueryClient();

  const schema = useMemo(() => createProfileSchema(tValidation), [tValidation]);

  const form = useForm<ProfileValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user.name,
      email: user.email,
      password: "",
      password_confirmation: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: ProfileValues) =>
      apiFetch<{ user: User }>("/api/parent/profile", {
        method: "PUT",
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          password: values.password || undefined,
          password_confirmation: values.password_confirmation || undefined,
        }),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["auth", "user"], data.user);
      form.reset({
        name: data.user.name,
        email: data.user.email,
        password: "",
        password_confirmation: "",
      });
      toast.success(t("profileUpdated"));
    },
    onError: (err) => {
      const message = applyServerErrors(form, err, KNOWN_FIELDS, t("profileUpdateError"));
      if (message) toast.error(message);
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
        className="flex flex-col gap-6"
      >
        <Section title={t("profileSection")}>
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
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("newPasswordLabel")}</FormLabel>
                <FormControl>
                  <PasswordInput {...field} className="h-10" />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  {t("newPasswordHint")}
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password_confirmation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("newPasswordConfirmationLabel")}</FormLabel>
                <FormControl>
                  <PasswordInput {...field} className="h-10" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        <Button type="submit" disabled={mutation.isPending} className="self-start">
          {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
          {mutation.isPending ? t("saving") : t("saveProfile")}
        </Button>
      </form>
    </Form>
  );
}
