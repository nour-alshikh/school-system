"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Loader2, Trash2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { Section } from "./guardian-fields";
import { Dropzone } from "./dropzone";
import { MAX_ATTACHMENT_SIZE } from "./schema";
import type { AttachmentType } from "@/types/generated";
import type { Student } from "./types";

// Unlike the rest of the edit form, uploads/deletes here take effect
// immediately against their own endpoints (see StudentController::
// storeAttachments/destroyAttachment) instead of waiting on the form's
// Save button — there's no meaningful "unsaved" state for a file that's
// already been picked up by a drop.
export function StudentAttachmentsTab({ student }: { student: Student }) {
  const t = useTranslations("StudentWizard");
  const tShow = useTranslations("StudentShowPage");
  const tPage = useTranslations("StudentsPage");
  const tValidation = useTranslations("Validation");
  const queryClient = useQueryClient();

  const [attachments, setAttachments] = useState<AttachmentType[]>(
    student.attachments
  );

  function syncCaches(next: AttachmentType[]) {
    setAttachments(next);
    queryClient.invalidateQueries({ queryKey: ["student", student.id] });
    queryClient.invalidateQueries({ queryKey: ["students"], exact: false });
  }

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => {
      const formData = new FormData();
      files.forEach((file) => formData.append("attachments[]", file));
      return apiFetch<{ student: Student }>(
        `/api/students/${student.id}/attachments`,
        { method: "POST", body: formData }
      );
    },
    onSuccess: (data) => syncCaches(data.student.attachments),
    onError: (err) => {
      toast.error(
        err instanceof ApiError ? err.message : tShow("attachmentsUploadError")
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (attachmentId: number) =>
      apiFetch<{ student: Student }>(
        `/api/students/${student.id}/attachments/${attachmentId}`,
        { method: "DELETE" }
      ),
    onSuccess: (data) => syncCaches(data.student.attachments),
    onError: (err) => {
      toast.error(
        err instanceof ApiError ? err.message : tShow("attachmentsDeleteError")
      );
    },
  });

  const deletingId = deleteMutation.isPending
    ? deleteMutation.variables
    : undefined;

  function handleFilesAdded(files: File[]) {
    const accepted: File[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        toast.error(tValidation("attachmentImageOnly"));
      } else if (file.size > MAX_ATTACHMENT_SIZE) {
        toast.error(tValidation("attachmentTooLarge"));
      } else {
        accepted.push(file);
      }
    }
    if (accepted.length > 0) uploadMutation.mutate(accepted);
  }

  return (
    <Section title={t("sectionAttachments")}>
      <Dropzone
        onFilesAdded={handleFilesAdded}
        label={t("attachmentsLabel")}
        hint={t("attachmentsHint")}
        disabled={uploadMutation.isPending}
      />

      {uploadMutation.isPending && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          {tShow("attachmentsUploading")}
        </p>
      )}

      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {tShow("attachmentsNone")}
        </p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={attachment.url}
                alt={attachment.name}
                className="h-24 w-24 rounded-md border object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 rounded-b-md bg-background/80 p-1">
                <a
                  href={`/api/students/${student.id}/attachments/${attachment.id}/download`}
                  download
                  aria-label={tShow("download")}
                  title={tShow("download")}
                  className="flex size-6 items-center justify-center rounded text-foreground hover:bg-muted"
                >
                  <Download className="size-3.5" />
                </a>
                <button
                  type="button"
                  aria-label={tPage("delete")}
                  title={tPage("delete")}
                  disabled={deletingId === attachment.id}
                  onClick={() => deleteMutation.mutate(attachment.id)}
                  className="flex size-6 items-center justify-center rounded text-destructive hover:bg-muted"
                >
                  {deletingId === attachment.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
