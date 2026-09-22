import { z } from "zod";
import type { PostCategory, PostStatus, PostTag } from "@/types/post";

// Mirrors the option lists PostStatus/PostCategory/PostTag are generated
// from on the backend (see app/Enums) — keep in sync with those enums.
export const postStatusOptions = ["draft", "published"] as const satisfies readonly PostStatus[];
export const postCategoryOptions = [
  "general",
  "tutorial",
  "news",
  "opinion",
] as const satisfies readonly PostCategory[];
export const postTagOptions = [
  "laravel",
  "nextjs",
  "typescript",
  "react",
  "php",
  "testing",
] as const satisfies readonly PostTag[];

// Validation messages come from the caller's `useTranslations("Validation")`
// so they follow the active locale — these schemas are built inside
// components (see createXSchema usages), not imported as static constants.
type Translate = (key: string) => string;

export const loginRoles = ["admin", "teacher", "student", "parent"] as const;
export type LoginRole = (typeof loginRoles)[number];

export function createLoginSchema(t: Translate) {
  return z.object({
    email: z.email(t("emailInvalid")),
    password: z.string().min(1, t("passwordRequired")),
  });
}

export type LoginFormValues = z.infer<ReturnType<typeof createLoginSchema>>;
export type LoginPayload = LoginFormValues & { role: LoginRole };

export function createRegisterSchema(t: Translate) {
  return z
    .object({
      name: z.string().min(1, t("nameRequired")).max(255),
      email: z.email(t("emailInvalid")),
      password: z.string().min(8, t("passwordMin")),
      password_confirmation: z.string(),
    })
    .refine((data) => data.password === data.password_confirmation, {
      message: t("passwordsDontMatch"),
      path: ["password_confirmation"],
    });
}

export type RegisterPayload = z.infer<ReturnType<typeof createRegisterSchema>>;

export function createForgotPasswordSchema(t: Translate) {
  return z.object({
    email: z.email(t("emailInvalid")),
  });
}

export type ForgotPasswordPayload = z.infer<
  ReturnType<typeof createForgotPasswordSchema>
>;

// token/email aren't user-editable form fields (they come from the reset
// link's URL), so they're merged in at submit time rather than being part of
// the schema react-hook-form validates against.
export function createResetPasswordFormSchema(t: Translate) {
  return z
    .object({
      password: z.string().min(8, t("passwordMin")),
      password_confirmation: z.string(),
    })
    .refine((data) => data.password === data.password_confirmation, {
      message: t("passwordsDontMatch"),
      path: ["password_confirmation"],
    });
}

export type ResetPasswordFormValues = z.infer<
  ReturnType<typeof createResetPasswordFormSchema>
>;

export interface ResetPasswordPayload extends ResetPasswordFormValues {
  token: string;
  email: string;
}

export function createPostSchema(t: Translate) {
  return z.object({
    title: z.string().min(1, t("titleRequired")).max(255),
    body: z.string().min(1, t("contentRequired")),
    status: z.enum(postStatusOptions),
    category: z.enum(postCategoryOptions),
    tags: z.array(z.enum(postTagOptions)),
    is_featured: z.boolean(),
    reading_minutes: z.coerce
      .number()
      .int()
      .min(1, t("readingMinutesMin"))
      .max(180, t("readingMinutesMax")),
    priority: z.coerce.number().int().min(1).max(5),
    // Empty string means "no publish date yet" — converted to null at submit
    // time (see PostForm), since a native date input can't hold null itself.
    published_at: z.string(),
  });
}

// reading_minutes/priority use z.coerce, so the schema's input type (raw
// form state, pre-coercion) and output type (after validation) differ —
// PostFormInput feeds useForm/defaultValues, PostFormValues is what
// handleSubmit hands to the submit callback.
export type PostFormInput = z.input<ReturnType<typeof createPostSchema>>;
export type PostFormValues = z.output<ReturnType<typeof createPostSchema>>;
