import { z } from "zod";

// Validation messages come from the caller's `useTranslations("Validation")`
// so they follow the active locale — same convention as meetings/schema.ts.
type Translate = (key: string) => string;

export const libraryResourceKinds = ["file", "link"] as const;
export type LibraryResourceKindValue = (typeof libraryResourceKinds)[number];

// Matches the backend's `max:1024` (kilobytes) on Store/
// UpdateLibraryResourceFileRequest — see docs/forms.md for why this stays
// hand-mirrored instead of generated.
export const MAX_LIBRARY_FILE_SIZE = 1024 * 1024;

// `fileRequired` is only true when a file-type resource has no file yet
// (a brand-new one, or an existing link-type resource being switched to
// file) — editing a file-type resource that already has one shouldn't force
// picking a new file just to save an unrelated field.
export function createLibraryResourceSchema(t: Translate, fileRequired: boolean) {
  return z
    .object({
      title: z.string().min(1, t("libraryTitleRequired")).max(255),
      description: z.string().max(5000).optional().or(z.literal("")),
      type: z.enum(libraryResourceKinds),
      url: z.string().max(2048).optional().or(z.literal("")),
      file: z
        .instanceof(File)
        .refine((f) => f.size <= MAX_LIBRARY_FILE_SIZE, t("libraryFileTooLarge"))
        .optional(),
      grade_id: z.string().min(1, t("libraryGradeRequired")),
      subject_ids: z.array(z.string()),
    })
    .superRefine((values, ctx) => {
      if (values.type === "link") {
        if (!values.url) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t("libraryUrlRequired"),
            path: ["url"],
          });
        } else if (!z.string().url().safeParse(values.url).success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t("libraryUrlInvalid"),
            path: ["url"],
          });
        }
      }

      if (values.type === "file" && fileRequired && !values.file) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("libraryFileRequired"),
          path: ["file"],
        });
      }
    });
}

export type LibraryResourceFormValues = z.infer<
  ReturnType<typeof createLibraryResourceSchema>
>;

export const defaultLibraryResourceValues: LibraryResourceFormValues = {
  title: "",
  description: "",
  type: "link",
  url: "",
  file: undefined,
  grade_id: "",
  subject_ids: [],
};
