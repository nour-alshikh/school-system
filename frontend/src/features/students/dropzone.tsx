"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

// Drag-and-drop file picker — hands raw files up to the caller, which does
// its own type/size validation (the wizard's zod schema, the edit tab's
// immediate-upload toast) rather than duplicating that here.
export function Dropzone({
  onFilesAdded,
  accept = "image/*",
  multiple = true,
  label,
  hint,
  disabled,
}: {
  onFilesAdded: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    onFilesAdded(Array.from(fileList));
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (!disabled) addFiles(e.dataTransfer.files);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors",
        isDragging ? "border-primary bg-primary/5" : "border-input",
        disabled && "pointer-events-none cursor-not-allowed opacity-50"
      )}
    >
      <UploadCloud className="size-6 text-muted-foreground" />
      <p className="text-sm font-medium">{label}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
        className="hidden"
      />
    </div>
  );
}
