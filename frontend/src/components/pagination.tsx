"use client";

import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export type PageMeta = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

export function Pagination({
  meta,
  onPageChange,
}: {
  meta: PageMeta;
  onPageChange: (page: number) => void;
}) {
  const t = useTranslations("Pagination");

  if (meta.last_page <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground">
        {t("pageInfo", { page: meta.current_page, lastPage: meta.last_page })}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={meta.current_page <= 1}
          onClick={() => onPageChange(meta.current_page - 1)}
        >
          <ChevronLeft className="size-4" />
          {t("previous")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={meta.current_page >= meta.last_page}
          onClick={() => onPageChange(meta.current_page + 1)}
        >
          {t("next")}
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
