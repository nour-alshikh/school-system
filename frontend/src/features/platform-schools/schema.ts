import { z } from "zod";

type Translate = (key: string) => string;

export function createSchoolSchema(t: Translate) {
  return z.object({
    name: z.string().trim().min(1, t("nameRequired")),
    // Same rule as the API: lowercase words joined by single hyphens.
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, t("slugInvalid")),
    admin_name: z.string().trim().min(1, t("nameRequired")),
    admin_email: z.email(t("emailInvalid")),
  });
}

export type SchoolFormValues = z.infer<ReturnType<typeof createSchoolSchema>>;
