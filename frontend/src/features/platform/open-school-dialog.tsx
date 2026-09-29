"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { DoorOpen } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/contexts/auth-context";
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

type Values = { code: string; reason?: string };

// A code is asked for only when two-factor is on (user.platform_two_factor).
function makeSchema(needsCode: boolean) {
  return z.object({
    code: needsCode ? z.string().trim().min(6).max(10) : z.string(),
    reason: z.string().max(500).optional(),
  });
}

/**
 * "Open school": a fresh two-factor code and an optional reason, then the
 * school's own pages as its admin (docs/central-dashboard-plan.md, phase 5).
 */
export function OpenSchoolDialog({ schoolId, schoolName }: { schoolId: number; schoolName: string }) {
  const t = useTranslations("Platform.enter");
  const tErrors = useTranslations("Errors");
  const { enterSchool, user } = useAuth();
  const needsCode = user?.platform_two_factor ?? true;
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useForm<Values>({ resolver: zodResolver(makeSchema(needsCode)), defaultValues: { code: "", reason: "" } });

  async function onSubmit(values: Values) {
    try {
      await enterSchool(schoolId, values.code, values.reason);
      setOpen(false);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      const message = applyServerErrors(form, err, ["code", "reason"], tErrors("somethingWentWrong"));
      if (message) toast.error(message);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <DoorOpen className="size-4" />
        {t("button")}
      </Button>
      <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) form.reset(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("title", { school: schoolName })}</DialogTitle>
            <DialogDescription>{needsCode ? t("description") : t("descriptionNoCode")}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              {needsCode && (
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("codeLabel")}</FormLabel>
                    <FormControl>
                      <Input dir="ltr" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              )}
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("reasonLabel")}</FormLabel>
                    <FormControl>
                      <Textarea rows={2} placeholder={t("reasonPlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? t("opening") : t("open")}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
