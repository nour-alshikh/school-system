"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import type { Setting } from "./types";

/**
 * Logo/favicon are stored as a media file on their own Setting row (see
 * Setting::registerMediaCollections()), not as a plain text value — so
 * each one uploads immediately through its own endpoint, the same way
 * AvatarUploader does for a user's avatar, instead of going through the
 * bulk text-fields submit.
 */
export function SettingFileField({
  settingKey,
  label,
  fileUrl,
}: {
  settingKey: string;
  label: string;
  fileUrl: string | null;
}) {
  const t = useTranslations("SettingsPage");
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      return apiFetch<{ setting: Setting }>(
        `/api/settings/${settingKey}/file`,
        { method: "POST", body: formData }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success(t("fileUploadSuccess"));
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError
          ? (err.errors?.file?.[0] ?? err.message)
          : t("fileUploadError")
      );
    },
  });

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsUploading(true);
    try {
      await uploadMutation.mutateAsync(file);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>

      <div className="flex items-center gap-3">
        {fileUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fileUrl}
            alt={label}
            className="h-12 w-12 rounded border object-contain"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded border text-xs text-muted-foreground">
            {t("noFile")}
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? t("uploading") : t("changeFile")}
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
