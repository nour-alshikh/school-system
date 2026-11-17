"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createSettingsSchema,
  SETTING_TEXT_KEYS,
  type SettingsFormValues,
} from "./schema";
import { SettingFileField } from "./setting-file-field";
import { SchoolWeekField } from "./school-week-field";
import { SCHOOL_CURRENCIES } from "@/lib/money";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Setting } from "./types";

function valuesFromSettings(settings: Setting[]): SettingsFormValues {
  const byKey = new Map(settings.map((s) => [s.key, s.value ?? ""]));

  return {
    ...Object.fromEntries(SETTING_TEXT_KEYS.map((key) => [key, byKey.get(key) ?? ""])),
    ai_enabled: byKey.get("ai_enabled") !== "0",
  } as SettingsFormValues;
}

export function SettingsForm({
  settings,
  initialTab = "general",
}: {
  settings: Setting[];
  /** ?tab= on the page, so links (e.g. the setup checklist) can open a tab. */
  initialTab?: string;
}) {
  const t = useTranslations("SettingsPage");
  const tValidation = useTranslations("Validation");
  const tErrors = useTranslations("Errors");
  const queryClient = useQueryClient();

  const schema = useMemo(() => createSettingsSchema(tValidation), [tValidation]);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(schema),
    defaultValues: valuesFromSettings(settings),
  });

  const { user } = useAuth();
  // The plan decides whether AI exists at all; this setting only turns it off.
  const planHasAi = !!user?.plan_features?.includes("ai");

  const locale = useLocale();
  // "EGP — Egyptian Pound" / "EGP — جنيه مصري", in the UI's language.
  const currencyNames = useMemo(
    () => new Intl.DisplayNames(locale, { type: "currency" }),
    [locale]
  );
  const currencyLabel = (code: string) =>
    `${code} — ${currencyNames.of(code) ?? code}`;

  const logo = settings.find((s) => s.key === "logo");
  const favicon = settings.find((s) => s.key === "favicon");
  const ogImage = settings.find((s) => s.key === "og_image");

  const mutation = useMutation({
    mutationFn: (values: SettingsFormValues) =>
      apiFetch<{ settings: Setting[] }>("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          settings: [
            ...SETTING_TEXT_KEYS.map((key) => ({
              key,
              value: values[key] || null,
            })),
            { key: "ai_enabled", value: values.ai_enabled ? "1" : "0" },
          ],
        }),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["settings"], data.settings);
      // user.ai_available follows the ai_enabled setting.
      void queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
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
        <Tabs defaultValue={initialTab}>
          <TabsList>
            <TabsTrigger value="general">{t("generalTab")}</TabsTrigger>
            <TabsTrigger value="school-year">{t("schoolYearTab")}</TabsTrigger>
            <TabsTrigger value="branding">{t("brandingTab")}</TabsTrigger>
            <TabsTrigger value="contact">{t("contactTab")}</TabsTrigger>
            <TabsTrigger value="social">{t("socialTab")}</TabsTrigger>
            <TabsTrigger value="seo">{t("seoTab")}</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-4">
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
            {planHasAi && (
              <FormField
                control={form.control}
                name="ai_enabled"
                render={({ field }) => (
                  <FormItem className="mt-2 rounded-lg border p-3">
                    <Label className="flex items-center gap-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) => field.onChange(checked === true)}
                        />
                      </FormControl>
                      <Sparkles className="size-4 text-brand-accent-strong dark:text-brand-accent" />
                      {t("aiEnabledLabel")}
                    </Label>
                    <p className="text-xs text-muted-foreground">{t("aiEnabledHint")}</p>
                  </FormItem>
                )}
              />
            )}
          </TabsContent>

          <TabsContent value="school-year" className="mt-4 flex flex-col gap-4">
            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("currencyLabel")}</FormLabel>
                  <Select
                    items={SCHOOL_CURRENCIES.map((code) => ({
                      value: code,
                      label: currencyLabel(code),
                    }))}
                    value={field.value || null}
                    onValueChange={(value) => field.onChange(value ?? "")}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full sm:w-80">
                        <SelectValue placeholder={t("currencyPlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SCHOOL_CURRENCIES.map((code) => (
                        <SelectItem key={code} value={code}>
                          {currencyLabel(code)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t("currencyHint")}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="school_days"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("schoolDaysLabel")}</FormLabel>
                  <SchoolWeekField
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("schoolDaysHint")}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>

          <TabsContent value="branding" className="mt-4">
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

          <TabsContent value="contact" className="mt-4">
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

          <TabsContent value="social" className="mt-4">
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

          <TabsContent value="seo" className="mt-4">
            <FormField
              control={form.control}
              name="meta_title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("metaTitleLabel")}</FormLabel>
                  <FormControl>
                    <Input {...field} className="h-10" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="meta_description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("metaDescriptionLabel")}</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <SettingFileField
              settingKey="og_image"
              label={t("ogImageLabel")}
              fileUrl={ogImage?.file_url ?? null}
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
