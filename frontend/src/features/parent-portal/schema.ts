import { z } from "zod";
import { guardianSchema } from "@/features/students/schema";
import type { Student } from "./types";

// Validation messages come from the caller's `useTranslations("Validation")`
// — same convention as the other schema files (see lib/schemas.ts).
type Translate = (key: string) => string;

export function createProfileSchema(t: Translate) {
  return z
    .object({
      name: z.string().min(1, t("nameRequired")).max(255),
      email: z.string().min(1, t("passwordRequired")).email(t("emailInvalid")),
      password: z.string().max(255).optional().or(z.literal("")),
      password_confirmation: z.string().optional().or(z.literal("")),
    })
    .refine((v) => !v.password || v.password.length >= 8, {
      message: t("passwordMin"),
      path: ["password"],
    })
    .refine((v) => v.password === v.password_confirmation, {
      message: t("passwordsDontMatch"),
      path: ["password_confirmation"],
    });
}

export type ProfileValues = z.infer<ReturnType<typeof createProfileSchema>>;

export function createStudentGuardiansSchema(t: Translate) {
  return z.object({
    father: guardianSchema(t),
    mother: guardianSchema(t),
  });
}

export type StudentGuardiansValues = z.infer<
  ReturnType<typeof createStudentGuardiansSchema>
>;

function guardianDefaults(guardian: Student["father"]): StudentGuardiansValues["father"] {
  return {
    name: guardian.name,
    job: guardian.job,
    national_id: guardian.national_id,
    phone: guardian.phone,
    nationality_id: String(guardian.nationality_id),
    governorate_id: String(guardian.governorate_id),
    blood_type_id: String(guardian.blood_type_id),
    religion_id: String(guardian.religion_id),
    address: guardian.address,
  };
}

export function studentGuardiansDefaults(student: Student): StudentGuardiansValues {
  return {
    father: guardianDefaults(student.father),
    mother: guardianDefaults(student.mother),
  };
}

export function toGuardiansPayload(values: StudentGuardiansValues) {
  return {
    father: {
      ...values.father,
      nationality_id: Number(values.father.nationality_id),
      governorate_id: Number(values.father.governorate_id),
      blood_type_id: Number(values.father.blood_type_id),
      religion_id: Number(values.father.religion_id),
    },
    mother: {
      ...values.mother,
      nationality_id: Number(values.mother.nationality_id),
      governorate_id: Number(values.mother.governorate_id),
      blood_type_id: Number(values.mother.blood_type_id),
      religion_id: Number(values.mother.religion_id),
    },
  };
}
