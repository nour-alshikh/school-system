import { z } from "zod";

// Validation messages come from the caller's `useTranslations("Validation")`
// — same convention as stages' schema.ts. The backend only requires each
// key to exist (see UpdateSettingsRequest); these stricter per-field rules
// (email/url shape, required school name) are UX only, not duplicated
// server-side authority.
type Translate = (key: string) => string;

const optionalText = (max: number) => z.string().max(max).optional();

export function createSettingsSchema(t: Translate) {
  return z.object({
    school_name: z.string().min(1, t("schoolNameRequired")).max(255),
    tagline: optionalText(255),

    // Chosen from fixed options (see school-week-field.tsx and
    // SCHOOL_CURRENCIES); the API validates both.
    currency: optionalText(3),
    school_days: optionalText(20),

    primary_color: optionalText(20),

    address: optionalText(500),
    phone: optionalText(50),
    email: z
      .union([z.literal(""), z.string().email(t("emailInvalid"))])
      .optional(),

    facebook_url: z
      .union([z.literal(""), z.string().url(t("invalidUrl"))])
      .optional(),
    twitter_url: z
      .union([z.literal(""), z.string().url(t("invalidUrl"))])
      .optional(),
    instagram_url: z
      .union([z.literal(""), z.string().url(t("invalidUrl"))])
      .optional(),
    youtube_url: z
      .union([z.literal(""), z.string().url(t("invalidUrl"))])
      .optional(),
    linkedin_url: z
      .union([z.literal(""), z.string().url(t("invalidUrl"))])
      .optional(),

    meta_title: optionalText(255),
    meta_description: optionalText(500),

    // Stored as "1"/"0" (empty: on), sent separately from the text keys.
    ai_enabled: z.boolean(),
    // "1" lets the assistant look up school data; empty or "0": off.
    assistant_data: z.boolean(),
  });
}

export type SettingsFormValues = z.infer<ReturnType<typeof createSettingsSchema>>;

export const SETTING_TEXT_KEYS = [
  "school_name",
  "tagline",
  "currency",
  "school_days",
  "primary_color",
  "address",
  "phone",
  "email",
  "facebook_url",
  "twitter_url",
  "instagram_url",
  "youtube_url",
  "linkedin_url",
  "meta_title",
  "meta_description",
] as const satisfies readonly (keyof SettingsFormValues)[];
