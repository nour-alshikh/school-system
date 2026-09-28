"use client";

import { useLocale, useTranslations } from "next-intl";
import type { ParentChildType } from "@/types/generated";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function childLabel(child: ParentChildType, locale: string): string {
  const name = locale === "ar" ? child.student.name_ar : child.student.name_en;
  return `${name} · ${child.school_name}`;
}

/** Only rendered when there's a choice to make. */
export function ChildPicker({
  childList,
  selectedId,
  onSelect,
}: {
  childList: ParentChildType[];
  selectedId: number | undefined;
  onSelect: (studentId: number) => void;
}) {
  const t = useTranslations("ParentChildren");
  const locale = useLocale();

  if (childList.length < 2) return null;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="child-picker">{t("childLabel")}</Label>
      <Select
        items={childList.map((c) => ({
          value: String(c.student.id),
          label: childLabel(c, locale),
        }))}
        value={selectedId === undefined ? "" : String(selectedId)}
        onValueChange={(value) => value && onSelect(Number(value))}
      >
        <SelectTrigger id="child-picker" className="w-full sm:w-80">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {childList.map((c) => (
            <SelectItem key={c.student.id} value={String(c.student.id)}>
              {childLabel(c, locale)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
