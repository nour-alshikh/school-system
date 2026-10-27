"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Megaphone, Mic, MicOff, Plus, Sparkles } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { apiFetch, ApiError } from "@/lib/api";
import { applyServerErrors } from "@/lib/form-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageLoader } from "@/components/page-loader";
import { formatDateTime } from "./format";
import { usePlatformPage } from "./use-platform-page";
import type { PlatformOverview } from "./types";

interface PlatformAnnouncement {
  id: number;
  title: { en?: string; ar?: string };
  body: { en?: string; ar?: string };
  level: "info" | "warning" | "critical";
  school: { id: number; name: string } | null;
  audience: string[] | null;
  starts_at: string;
  ends_at: string | null;
  active: boolean;
  created_by: string | null;
  dismissals_count: number;
}

const QUERY_KEY = ["platform", "announcements"];
const ROLES = ["admin", "teacher", "parent", "student"] as const;

/** ISO → the value a datetime-local input wants, in the browser's time zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Announcements to every school or one, by role
 * (docs/central-dashboard-plan.md, phase 8).
 */
export function AnnouncementsPage() {
  const t = useTranslations("Platform.announcements");
  const tRoles = useTranslations("LoginChooserPage");
  const tErrors = useTranslations("Errors");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { ready } = usePlatformPage();
  const [editing, setEditing] = useState<PlatformAnnouncement | "new" | null>(null);

  const { data } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiFetch<{ announcements: PlatformAnnouncement[] }>("/api/platform/announcements").then((d) => d.announcements),
    enabled: ready,
  });

  const end = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/platform/announcements/${id}/end`, { method: "POST" }),
    onSuccess: () => {
      toast.success(t("ended"));
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : tErrors("somethingWentWrong")),
  });

  if (!ready) return <PageLoader />;

  const title = (a: PlatformAnnouncement) => (locale === "ar" ? a.title.ar : a.title.en) ?? a.title.en ?? "";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">{t("heading")}</h1>
          <p className="text-sm text-muted-foreground">{t("subheading")}</p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4" />
          {t("new")}
        </Button>
      </div>

      {data && data.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border p-10 text-center text-sm text-muted-foreground">
          <Megaphone className="size-6" />
          {t("empty")}
        </div>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {(data ?? []).map((a) => (
            <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{title(a)}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{t(`level_${a.level}`)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${a.active ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                    {a.active ? t("live") : new Date(a.starts_at) > new Date() ? t("scheduled") : t("over")}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {a.school?.name ?? t("allSchools")} · {a.audience ? a.audience.map((r) => tRoles(r)).join(", ") : t("everyone")} ·{" "}
                  {formatDateTime(a.starts_at, locale)}
                  {a.ends_at && ` → ${formatDateTime(a.ends_at, locale)}`}
                  {a.dismissals_count > 0 && ` · ${t("dismissedBy", { count: a.dismissals_count })}`}
                </span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(a)}>{t("edit")}</Button>
                {a.active && (
                  <Button size="sm" variant="outline" disabled={end.isPending} onClick={() => end.mutate(a.id)}>{t("end")}</Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <AnnouncementDialog
          announcement={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: QUERY_KEY })}
        />
      )}
    </main>
  );
}

const schema = z.object({
  title_en: z.string().trim().min(1).max(200),
  title_ar: z.string().trim().min(1).max(200),
  body_en: z.string().max(2000),
  body_ar: z.string().max(2000),
  level: z.enum(["info", "warning", "critical"]),
  school_id: z.string(),
  audience: z.array(z.enum(ROLES)),
  starts_at: z.string(),
  ends_at: z.string(),
});
type Values = z.infer<typeof schema>;

function AnnouncementDialog({
  announcement,
  onClose,
  onSaved,
}: {
  announcement: PlatformAnnouncement | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("Platform.announcements");
  const tRoles = useTranslations("LoginChooserPage");
  const tErrors = useTranslations("Errors");
  const locale = useLocale();

  const { data: overview } = useQuery({
    queryKey: ["platform", "overview"],
    queryFn: () => apiFetch<PlatformOverview>("/api/platform/overview"),
  });
  const schools = (overview?.schools ?? []).filter((s) => s.status !== "archived");

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title_en: announcement?.title.en ?? "",
      title_ar: announcement?.title.ar ?? "",
      body_en: announcement?.body?.en ?? "",
      body_ar: announcement?.body?.ar ?? "",
      level: announcement?.level ?? "info",
      school_id: announcement?.school ? String(announcement.school.id) : "all",
      audience: (announcement?.audience ?? []) as Values["audience"],
      starts_at: toLocalInput(announcement?.starts_at ?? null),
      ends_at: toLocalInput(announcement?.ends_at ?? null),
    },
  });

  // AI draft from rough notes: fills the text fields, level and audience, saves nothing.
  const [notes, setNotes] = useState("");
  // Dictated phrases are appended to the notes, in the UI's language.
  const speech = useSpeechRecognition({
    lang: locale === "ar" ? "ar-SA" : "en-US",
    onText: (text) => setNotes((n) => (n.trim() ? `${n.trimEnd()} ${text}` : text).slice(0, 2000)),
    onError: (error) => toast.error(error === "not-allowed" || error === "service-not-allowed" ? t("micBlocked") : t("micFailed")),
  });
  const draft = useMutation({
    mutationFn: () =>
      apiFetch<{
        draft: { title: { en: string; ar: string }; body: { en: string; ar: string }; level: Values["level"]; audience: Values["audience"] };
      }>("/api/platform/announcements/draft", {
        method: "POST",
        body: JSON.stringify({ notes }),
      }).then((d) => d.draft),
    onSuccess: (d) => {
      const opts = { shouldDirty: true, shouldValidate: true };
      form.setValue("title_en", d.title.en, opts);
      form.setValue("title_ar", d.title.ar, opts);
      form.setValue("body_en", d.body.en, opts);
      form.setValue("body_ar", d.body.ar, opts);
      form.setValue("level", d.level, opts);
      form.setValue("audience", d.audience, opts);
      toast.success(t("aiDrafted"));
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : tErrors("somethingWentWrong")),
  });

  async function onSubmit(v: Values) {
    const payload = {
      title: { en: v.title_en, ar: v.title_ar },
      body: { en: v.body_en || null, ar: v.body_ar || null },
      level: v.level,
      school_id: v.school_id === "all" ? null : Number(v.school_id),
      // None ticked: everyone.
      audience: v.audience.length ? v.audience : null,
      starts_at: v.starts_at ? new Date(v.starts_at).toISOString() : null,
      ends_at: v.ends_at ? new Date(v.ends_at).toISOString() : null,
    };
    try {
      await apiFetch(announcement ? `/api/platform/announcements/${announcement.id}` : "/api/platform/announcements", {
        method: announcement ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      toast.success(t("saved"));
      onSaved();
      onClose();
    } catch (err) {
      const message = applyServerErrors(form, err, [], tErrors("somethingWentWrong"));
      if (message) toast.error(message);
    }
  }

  const text = (name: "title_en" | "title_ar", label: string, dir: "ltr" | "rtl") => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl><Input dir={dir} {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
  const area = (name: "body_en" | "body_ar", label: string, dir: "ltr" | "rtl") => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl><Textarea rows={3} dir={dir} {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{announcement ? t("editTitle") : t("newTitle")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
              <Label htmlFor="ai-notes" className="flex items-center gap-2">
                <Sparkles className="size-4" />
                {t("aiHeading")}
              </Label>
              <Textarea
                id="ai-notes"
                rows={2}
                maxLength={2000}
                placeholder={t("aiNotesPlaceholder")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{t("aiHint")}</p>
                <div className="flex items-center gap-2">
                  {speech.supported && (
                    <Button
                      type="button"
                      size="sm"
                      variant={speech.listening ? "destructive" : "outline"}
                      aria-pressed={speech.listening}
                      disabled={draft.isPending}
                      onClick={speech.listening ? speech.stop : speech.start}
                    >
                      {speech.listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                      {speech.listening ? t("micStop") : t("micStart")}
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!notes.trim() || draft.isPending}
                    onClick={() => {
                      speech.stop();
                      draft.mutate();
                    }}
                  >
                    {draft.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                    {t("aiDraft")}
                  </Button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {text("title_en", t("titleEn"), "ltr")}
              {text("title_ar", t("titleAr"), "rtl")}
              {area("body_en", t("bodyEn"), "ltr")}
              {area("body_ar", t("bodyAr"), "rtl")}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("level")}</FormLabel>
                    <Select
                      items={(["info", "warning", "critical"] as const).map((l) => ({ value: l, label: t(`level_${l}`) }))}
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {(["info", "warning", "critical"] as const).map((l) => (
                          <SelectItem key={l} value={l}>{t(`level_${l}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{t("criticalHint")}</p>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="school_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("school")}</FormLabel>
                    <Select
                      items={[{ value: "all", label: t("allSchools") }, ...schools.map((s) => ({ value: String(s.id), label: s.name }))]}
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="all">{t("allSchools")}</SelectItem>
                        {schools.map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">{t("audience")}</legend>
              <Controller
                control={form.control}
                name="audience"
                render={({ field }) => (
                  <div className="flex flex-wrap gap-4">
                    {ROLES.map((role) => (
                      <Label key={role} className="flex items-center gap-2 font-normal">
                        <Checkbox
                          checked={field.value.includes(role)}
                          onCheckedChange={(checked) =>
                            field.onChange(checked ? [...field.value, role] : field.value.filter((r) => r !== role))
                          }
                        />
                        {tRoles(role)}
                      </Label>
                    ))}
                  </div>
                )}
              />
              <p className="text-xs text-muted-foreground">{t("audienceHint")}</p>
            </fieldset>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="starts_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("startsAt")}</FormLabel>
                    <FormControl><Input type="datetime-local" {...field} /></FormControl>
                    <p className="text-xs text-muted-foreground">{t("startsAtHint")}</p>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ends_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("endsAt")}</FormLabel>
                    <FormControl><Input type="datetime-local" {...field} /></FormControl>
                    <p className="text-xs text-muted-foreground">{t("endsAtHint")}</p>
                  </FormItem>
                )}
              />
            </div>
            <Button type="submit" className="self-start" disabled={form.formState.isSubmitting}>{t("save")}</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
