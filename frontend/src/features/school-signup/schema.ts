import { z } from "zod";

type Translate = (key: string) => string;

// Same rule as the API's SchoolSlug: 3–63 lowercase words joined by single
// hyphens. Reserved and taken slugs are only known server-side (see
// useSlugAvailability).
function slugField(t: Translate) {
  return z
    .string()
    .trim()
    .min(3, t("slugLength"))
    .max(63, t("slugLength"))
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, t("slugInvalid"));
}

function schoolFields(t: Translate) {
  return {
    school_name: z.string().trim().min(1, t("schoolNameRequired")).max(255),
    slug: slugField(t),
  };
}

/** A signed-in user adding a school (POST /api/schools). */
export function createNewSchoolSchema(t: Translate) {
  return z.object(schoolFields(t));
}

export type NewSchoolPayload = z.infer<ReturnType<typeof createNewSchoolSchema>>;

/** A guest: account + school in one go (POST /api/school-signup). */
export function createSchoolSignupSchema(t: Translate) {
  return z
    .object({
      ...schoolFields(t),
      name: z.string().trim().min(1, t("nameRequired")).max(255),
      email: z.email(t("emailInvalid")),
      password: z.string().min(8, t("passwordMin")),
      password_confirmation: z.string(),
      // Honeypot: hidden from people, left empty. See SchoolSignupRequest.
      website: z.string().optional(),
    })
    .refine((data) => data.password === data.password_confirmation, {
      message: t("passwordsDontMatch"),
      path: ["password_confirmation"],
    });
}

export type SchoolSignupPayload = z.infer<
  ReturnType<typeof createSchoolSignupSchema>
>;

/**
 * A suggested slug from the school's name: "Green Valley School" →
 * "green-valley-school". Letters without a Latin form (Arabic names) drop
 * out, leaving it for the user to type.
 */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    .replace(/-+$/, "");
}
