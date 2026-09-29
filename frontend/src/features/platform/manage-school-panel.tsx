"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Archive, Download, FileArchive, PauseCircle, PlayCircle, Terminal } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { applyServerErrors } from "@/lib/form-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { formatBytes, formatDateTime, timeAgo } from "./format";
import { PLANS_QUERY_KEY, usePlans } from "./plans-page";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PlatformSchoolDetail } from "./types";

type School = PlatformSchoolDetail["school"];

interface SchoolExport {
  id: number;
  size: number;
  created_at: string;
  expires_at: string;
  expired: boolean;
  created_by: string | null;
}

const ARCHIVE_DAYS = 30;

/**
 * A school's lifecycle (docs/central-dashboard-plan.md, phase 7): edit its
 * details, suspend or archive it with a reason, bring it back, and export
 * its data. Purging stays a command-line step.
 */
export function ManageSchoolPanel({ school }: { school: School }) {
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["platform", "school", String(school.id)] });
    queryClient.invalidateQueries({ queryKey: ["platform", "overview"] });
  };

  return (
    <div className="flex flex-col gap-6">
      <PlanCard school={school} onChanged={refresh} />
      <EditForm school={school} onSaved={refresh} />
      <StatusCard school={school} onChanged={refresh} />
      <ExportsCard school={school} />
    </div>
  );
}

const editSchema = z.object({
  name: z.string().trim().min(1).max(255),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(63),
  primary_color: z.string().max(20).optional(),
  email: z.union([z.literal(""), z.email()]).optional(),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
});
type EditValues = z.infer<typeof editSchema>;

function EditForm({ school, onSaved }: { school: School; onSaved: () => void }) {
  const t = useTranslations("Platform.manage");
  const tErrors = useTranslations("Errors");
  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: school.name,
      slug: school.slug,
      primary_color: school.settings.primary_color ?? "",
      email: school.settings.email ?? "",
      phone: school.settings.phone ?? "",
      address: school.settings.address ?? "",
    },
  });

  async function onSubmit({ name, slug, ...settings }: EditValues) {
    try {
      await apiFetch(`/api/platform/schools/${school.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, slug, settings }),
      });
      toast.success(t("saved"));
      onSaved();
    } catch (err) {
      const message = applyServerErrors(form, err, ["name", "slug"], tErrors("somethingWentWrong"));
      if (message) toast.error(message);
    }
  }

  const text = (name: keyof EditValues, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl><Input {...props} {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">{t("detailsHeading")}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {text("name", t("name"))}
          <div className="flex flex-col gap-1">
            {text("slug", t("slug"), { dir: "ltr" })}
            <p className="text-xs text-muted-foreground">{t("slugWarning")}</p>
          </div>
          {text("email", t("email"), { dir: "ltr", type: "email" })}
          {text("phone", t("phone"), { dir: "ltr" })}
          {text("address", t("address"))}
          {text("primary_color", t("primaryColor"), { type: "color", className: "h-10 w-20 p-1" })}
        </div>
        <p className="text-xs text-muted-foreground">{t("logoHint")}</p>
        <Button type="submit" className="self-start" disabled={form.formState.isSubmitting}>{t("save")}</Button>
      </form>
    </Form>
  );
}

function PlanCard({ school, onChanged }: { school: School; onChanged: () => void }) {
  const t = useTranslations("Platform.manage");
  const tErrors = useTranslations("Errors");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { data } = usePlans();
  const [saving, setSaving] = useState(false);
  const plan = school.plan;

  async function change(planId: string | null) {
    if (!planId || Number(planId) === plan.id) return;
    setSaving(true);
    try {
      await apiFetch(`/api/platform/schools/${school.id}/plan`, { method: "PUT", body: JSON.stringify({ plan_id: Number(planId) }) });
      toast.success(t("planChanged"));
      queryClient.invalidateQueries({ queryKey: PLANS_QUERY_KEY });
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tErrors("somethingWentWrong"));
    } finally {
      setSaving(false);
    }
  }

  const number = (n: number) => new Intl.NumberFormat(locale).format(n);
  const usage = (used: string, max: string | null) => (max === null ? t("usageNoLimit", { used }) : t("usageOf", { used, max }));

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="text-sm font-semibold">{t("planHeading")}</h2>
      <Select
        items={(data?.plans ?? []).map((p) => ({ value: String(p.id), label: p.name }))}
        value={String(plan.id)}
        onValueChange={change}
        disabled={saving}
      >
        <SelectTrigger className="w-full sm:w-64" aria-label={t("planHeading")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(data?.plans ?? []).map((p) => (
            <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
        <li>{t("studentsUsage")}: {usage(number(school.students), plan.max_students === null ? null : number(plan.max_students))}</li>
        <li>{t("storageUsage")}: {usage(formatBytes(school.storage_bytes, locale), plan.max_storage_mb === null ? null : formatBytes(plan.max_storage_mb * 1024 * 1024, locale))}</li>
      </ul>
      <p className="text-xs text-muted-foreground">{t("planHint")}</p>
    </section>
  );
}

type StatusAction = "suspended" | "archived" | "active";
type StatusValues = { reason: string; confirm: string };

function StatusCard({ school, onChanged }: { school: School; onChanged: () => void }) {
  const t = useTranslations("Platform.manage");
  const locale = useLocale();
  const [action, setAction] = useState<StatusAction | null>(null);
  // Read once: rendering must not depend on the clock.
  const [now] = useState(() => Date.now());

  const archivedDaysAgo = school.archived_at ? Math.floor((now - new Date(school.archived_at).getTime()) / 86400000) : null;
  const canRestore = school.status !== "archived" || (archivedDaysAgo !== null && archivedDaysAgo < ARCHIVE_DAYS);

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="text-sm font-semibold">{t("statusHeading")}</h2>
      <p className="text-sm">
        {t(`status_${school.status}`)}
        {school.status_reason && <span className="text-muted-foreground"> · {school.status_reason}</span>}
      </p>
      {school.status === "archived" && school.archived_at && (
        <p className="text-xs text-muted-foreground">
          {canRestore
            ? t("restoreUntil", { date: formatDateTime(new Date(new Date(school.archived_at).getTime() + ARCHIVE_DAYS * 86400000).toISOString(), locale) })
            : t("restoreExpired")}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {school.status === "active" && (
          <Button variant="outline" onClick={() => setAction("suspended")}>
            <PauseCircle className="size-4" />
            {t("suspend")}
          </Button>
        )}
        {school.status !== "active" && canRestore && (
          <Button variant="outline" onClick={() => setAction("active")}>
            <PlayCircle className="size-4" />
            {school.status === "archived" ? t("restore") : t("reactivate")}
          </Button>
        )}
        {school.status !== "archived" && (
          <Button variant="destructive" onClick={() => setAction("archived")}>
            <Archive className="size-4" />
            {t("archive")}
          </Button>
        )}
      </div>
      {school.status === "archived" && (
        <div className="flex flex-col gap-1 rounded-md bg-muted/50 p-3 text-xs">
          <span className="flex items-center gap-1 font-medium"><Terminal className="size-3.5" />{t("purgeHeading")}</span>
          <span className="text-muted-foreground">{t("purgeHint", { days: ARCHIVE_DAYS })}</span>
          <code dir="ltr" className="mt-1 break-all">php artisan school:purge {school.id} --confirm={school.slug}</code>
        </div>
      )}
      {action && <StatusDialog school={school} action={action} onClose={() => setAction(null)} onDone={onChanged} />}
    </section>
  );
}

function StatusDialog({ school, action, onClose, onDone }: { school: School; action: StatusAction; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("Platform.manage");
  const tErrors = useTranslations("Errors");
  const needsReason = action !== "active";
  // Archiving is typed out: it signs everyone out and starts the purge clock.
  const needsSlug = action === "archived";
  const schema = z.object({
    reason: needsReason ? z.string().trim().min(1, t("reasonRequired")).max(500) : z.string().optional(),
    confirm: needsSlug ? z.literal(school.slug, { message: t("typeSlugError") }) : z.string().optional(),
  });
  const form = useForm<StatusValues>({ resolver: zodResolver(schema) as unknown as Resolver<StatusValues>, defaultValues: { reason: "", confirm: "" } });

  async function onSubmit({ reason }: StatusValues) {
    try {
      await apiFetch(`/api/platform/schools/${school.id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: action, reason: reason || null }),
      });
      toast.success(t(`done_${action}`));
      onDone();
      onClose();
    } catch (err) {
      const message = applyServerErrors(form, err, ["reason"], tErrors("somethingWentWrong"));
      if (message) toast.error(message);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t(`dialog_${action}_title`, { school: school.name })}</DialogTitle>
          <DialogDescription>{t(`dialog_${action}_body`, { days: ARCHIVE_DAYS })}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            {needsReason && (
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("reasonLabel")}</FormLabel>
                    <FormControl><Textarea rows={2} placeholder={t("reasonPlaceholder")} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {needsSlug && (
              <FormField
                control={form.control}
                name="confirm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("typeSlug", { slug: school.slug })}</FormLabel>
                    <FormControl><Input dir="ltr" autoComplete="off" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <Button type="submit" variant={action === "active" ? "default" : "destructive"} disabled={form.formState.isSubmitting}>
              {t(`dialog_${action}_action`)}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ExportsCard({ school }: { school: School }) {
  const t = useTranslations("Platform.manage");
  const tErrors = useTranslations("Errors");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const queryKey = ["platform", "exports", school.id];

  const { data } = useQuery({
    queryKey,
    queryFn: () => apiFetch<{ exports: SchoolExport[] }>(`/api/platform/schools/${school.id}/exports`),
  });

  const create = useMutation({
    mutationFn: () => apiFetch(`/api/platform/schools/${school.id}/export`, { method: "POST" }),
    onSuccess: () => {
      toast.success(t("exportReady"));
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : tErrors("somethingWentWrong")),
  });

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{t("exportHeading")}</h2>
          <p className="text-xs text-muted-foreground">{t("exportHint")}</p>
        </div>
        <Button variant="outline" onClick={() => create.mutate()} disabled={create.isPending}>
          <FileArchive className="size-4" />
          {create.isPending ? t("exporting") : t("export")}
        </Button>
      </div>
      {(data?.exports ?? []).length > 0 && (
        <ul className="divide-y rounded-md border text-sm">
          {data!.exports.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span className="text-muted-foreground">
                {formatDateTime(e.created_at, locale)} · {formatBytes(e.size, locale)}
                {e.created_by && ` · ${e.created_by}`}
              </span>
              {e.expired ? (
                <span className="text-xs text-muted-foreground">{t("expired")}</span>
              ) : (
                <a href={`/api/platform/exports/${e.id}/download`} className="inline-flex items-center gap-1 text-sm underline">
                  <Download className="size-3.5" />
                  {t("download")} <span className="text-xs text-muted-foreground">({t("expiresIn", { when: timeAgo(e.expires_at, locale) ?? "" })})</span>
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
