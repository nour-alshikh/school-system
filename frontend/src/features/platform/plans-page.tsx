"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { applyServerErrors } from "@/lib/form-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageLoader } from "@/components/page-loader";
import { formatBytes } from "./format";
import { usePlatformPage } from "./use-platform-page";

export interface Plan {
  id: number;
  key: string;
  name: string;
  max_students: number | null;
  max_storage_mb: number | null;
  features: string[];
  schools_count: number;
}

export const PLANS_QUERY_KEY = ["platform", "plans"];

export function usePlans(enabled = true) {
  return useQuery({
    queryKey: PLANS_QUERY_KEY,
    queryFn: () => apiFetch<{ plans: Plan[]; features: string[] }>("/api/platform/plans"),
    enabled,
  });
}

/**
 * Plans: how many students, how much storage, which modules
 * (docs/central-dashboard-plan.md, phase 9). Enforced server side; billing
 * is out of scope.
 */
export function PlansPage() {
  const t = useTranslations("Platform.plans");
  const locale = useLocale();
  const { ready } = usePlatformPage();
  const [editing, setEditing] = useState<Plan | null>(null);
  const { data } = usePlans(ready);

  if (!ready) return <PageLoader />;

  const number = (n: number) => new Intl.NumberFormat(locale).format(n);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t("heading")}</h1>
        <p className="text-sm text-muted-foreground">{t("subheading")}</p>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("plan")}</TableHead>
              <TableHead className="text-end">{t("students")}</TableHead>
              <TableHead className="text-end">{t("storage")}</TableHead>
              <TableHead>{t("modules")}</TableHead>
              <TableHead className="text-end">{t("schools")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.plans ?? []).map((plan) => (
              <TableRow key={plan.id}>
                <TableCell className="font-medium">{plan.name}</TableCell>
                <TableCell className="text-end tabular-nums">{plan.max_students === null ? t("noLimit") : number(plan.max_students)}</TableCell>
                <TableCell className="text-end tabular-nums">{plan.max_storage_mb === null ? t("noLimit") : formatBytes(plan.max_storage_mb * 1024 * 1024, locale)}</TableCell>
                <TableCell className="text-muted-foreground">{plan.features.map((f) => t(`feature_${f}`)).join(", ") || "—"}</TableCell>
                <TableCell className="text-end tabular-nums">{plan.schools_count}</TableCell>
                <TableCell className="text-end">
                  <Button size="sm" variant="outline" onClick={() => setEditing(plan)}>{t("edit")}</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">{t("limitsHint")}</p>
      {editing && data && <PlanDialog plan={editing} features={data.features} onClose={() => setEditing(null)} />}
    </main>
  );
}

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  // Empty: no limit.
  max_students: z.string().regex(/^\d*$/),
  max_storage_mb: z.string().regex(/^\d*$/),
  features: z.array(z.string()),
});
type Values = z.infer<typeof schema>;

function PlanDialog({ plan, features, onClose }: { plan: Plan; features: string[]; onClose: () => void }) {
  const t = useTranslations("Platform.plans");
  const tErrors = useTranslations("Errors");
  const queryClient = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: plan.name,
      max_students: plan.max_students === null ? "" : String(plan.max_students),
      max_storage_mb: plan.max_storage_mb === null ? "" : String(plan.max_storage_mb),
      features: plan.features,
    },
  });

  async function onSubmit(v: Values) {
    try {
      await apiFetch(`/api/platform/plans/${plan.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: v.name,
          max_students: v.max_students === "" ? null : Number(v.max_students),
          max_storage_mb: v.max_storage_mb === "" ? null : Number(v.max_storage_mb),
          features: v.features,
        }),
      });
      toast.success(t("saved"));
      queryClient.invalidateQueries({ queryKey: PLANS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["platform", "overview"] });
      onClose();
    } catch (err) {
      const message = applyServerErrors(form, err, ["name", "max_students", "max_storage_mb"], tErrors("somethingWentWrong"));
      if (message) toast.error(message);
    }
  }

  const numberField = (name: "max_students" | "max_storage_mb", label: string) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl><Input inputMode="numeric" placeholder={t("noLimit")} {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("editTitle", { plan: plan.name })}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("name")}</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {numberField("max_students", t("maxStudents"))}
            {numberField("max_storage_mb", t("maxStorageMb"))}
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">{t("modules")}</legend>
              <Controller
                control={form.control}
                name="features"
                render={({ field }) => (
                  <div className="flex flex-wrap gap-4">
                    {features.map((f) => (
                      <Label key={f} className="flex items-center gap-2 font-normal">
                        <Checkbox
                          checked={field.value.includes(f)}
                          onCheckedChange={(checked) =>
                            field.onChange(checked ? [...field.value, f] : field.value.filter((x) => x !== f))
                          }
                        />
                        {t(`feature_${f}`)}
                      </Label>
                    ))}
                  </div>
                )}
              />
            </fieldset>
            <p className="text-xs text-muted-foreground">{t("emptyMeansNoLimit")}</p>
            <Button type="submit" className="self-start" disabled={form.formState.isSubmitting}>{t("save")}</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
