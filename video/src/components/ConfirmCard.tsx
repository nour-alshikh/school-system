import { useCurrentFrame } from "remotion";
import { useTranslations } from "next-intl";
import { CalendarPlus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { popIn, progress } from "../lib/motion";
import { Press } from "./Ripple";

interface EventFields {
  title: string;
  date: string;
  description: string;
}

/**
 * The assistant's "New calendar event" action card (action-card.tsx,
 * create_event), rebuilt with the same markup, classes, real ui components
 * and real strings. Slides up at `at`; Confirm is pressed at `confirmAt`,
 * after which the card turns into the app's "done" line.
 */
export function ConfirmCard({ fields, at, confirmAt }: { fields: EventFields; at: number; confirmAt: number }) {
  const frame = useCurrentFrame();
  const t = useTranslations("Assistant.actions");
  if (frame < at) return null;

  const doneAt = confirmAt + 10;
  if (frame >= doneAt) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground" style={popIn(frame, doneAt)}>
        <Check className="size-3.5" />
        {t("title_create_event")} · {t("done")}
      </p>
    );
  }

  const rise = progress(frame, at, 16);
  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-brand-accent/40 bg-brand-accent/5 p-3"
      style={{ opacity: rise, transform: `translateY(${(1 - rise) * 24}px)` }}
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <CalendarPlus className="size-4 text-brand-accent-strong" />
        {t("title_create_event")}
      </p>
      <Field label={t("title")}>
        <Input readOnly value={fields.title} className="h-9 bg-background" />
      </Field>
      <Field label={t("date")}>
        <Input readOnly type="date" value={fields.date} className="h-9 bg-background" />
      </Field>
      <Field label={t("description")}>
        <Textarea readOnly rows={2} value={fields.description} className="bg-background" />
      </Field>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm">
          {t("dismiss")}
        </Button>
        <Press at={confirmAt} radius={12}>
          <Button type="button" size="sm">
            <Check className="size-4" />
            {t("confirm_create_event")}
          </Button>
        </Press>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      {children}
    </label>
  );
}
