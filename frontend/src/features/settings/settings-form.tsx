"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
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
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createSettingsSchema,
  SETTING_TEXT_KEYS,
  type SettingsFormValues,
} from "./schema";
import { SettingFileField } from "./setting-file-field";
import type { Setting } from "./types";

function valuesFromSettings(settings: Setting[]): SettingsFormValues {
  const byKey = new Map(settings.map((s) => [s.key, s.value ?? ""]));

  return Object.fromEntries(
    SETTING_TEXT_KEYS.map((key) => [key, byKey.get(key) ?? ""])
  ) as SettingsFormValues;
}

export function SettingsForm({ settings }: { settings: Setting[] }) {
  const t = useTranslations("SettingsPage");
  const tValidation = useTranslations("Validation");
  const tErrors = useTranslations("Errors");
  const queryClient = useQueryClient();

  const schema = useMemo(() => createSettingsSchema(tValidation), [tValidation]);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(schema),
    defaultValues: valuesFromSettings(settings),
  });

  const logo = settings.find((s) => s.key === "logo");
  const favicon = settings.find((s) => s.key === "favicon");

  const mutation = useMutation({
    mutationFn: (values: SettingsFormValues) =>
      apiFetch<{ settings: Setting[] }>("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          settings: SETTING_TEXT_KEYS.map((key) => ({
            key,
            value: values[key] || null,
          })),
        }),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["settings"], data.settings);
      toast.success(t("saveSuccess"));
    },
    onError: (err) => {
      const message = applyServerErrors(
        form,
        err,
        SETTING_TEXT_KEYS,
        tErrors("somethingWentWrong")
      );
      if (message) toast.error(message);
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        className="flex flex-col gap-6"
      >
        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">{t("generalTab")}</TabsTrigger>
            <TabsTrigger value="branding">{t("brandingTab")}</TabsTrigger>
            <TabsTrigger value="contact">{t("contactTab")}</TabsTrigger>
            <TabsTrigger value="social">{t("socialTab")}</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <FormField
              control={form.control}
              name="school_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("schoolNameLabel")}</FormLabel>
                  <FormControl>
                    <Input {...field} className="h-10" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tagline"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("taglineLabel")}</FormLabel>
                  <FormControl>
                    <Input {...field} className="h-10" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>

          <TabsContent value="branding">
            <SettingFileField
              settingKey="logo"
              label={t("logoLabel")}
              fileUrl={logo?.file_url ?? null}
            />
            <SettingFileField
              settingKey="favicon"
              label={t("faviconLabel")}
              fileUrl={favicon?.file_url ?? null}
            />
            <FormField
              control={form.control}
              name="primary_color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("primaryColorLabel")}</FormLabel>
                  <FormControl>
                    <Input {...field} type="color" className="h-10 w-20 p-1" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>

          <TabsContent value="contact">
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("addressLabel")}</FormLabel>
                  <FormControl>
                    <Input {...field} className="h-10" />
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
                    <Input {...field} type="email" className="h-10" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>

          <TabsContent value="social">
            <FormField
              control={form.control}
              name="facebook_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("facebookLabel")}</FormLabel>
                  <FormControl>
                    <Input {...field} type="url" dir="ltr" className="h-10" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="twitter_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("twitterLabel")}</FormLabel>
                  <FormControl>
                    <Input {...field} type="url" dir="ltr" className="h-10" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="instagram_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("instagramLabel")}</FormLabel>
                  <FormControl>
                    <Input {...field} type="url" dir="ltr" className="h-10" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="youtube_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("youtubeLabel")}</FormLabel>
                  <FormControl>
                    <Input {...field} type="url" dir="ltr" className="h-10" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="linkedin_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("linkedinLabel")}</FormLabel>
                  <FormControl>
                    <Input {...field} type="url" dir="ltr" className="h-10" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>
        </Tabs>

        <Button type="submit" disabled={mutation.isPending} className="self-start">
          {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
          {t("saveChanges")}
        </Button>
      </form>
    </Form>
  );
}
