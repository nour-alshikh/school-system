import { z } from "zod";
import type { Path } from "react-hook-form";
import type { Student } from "./types";

// Validation messages come from the caller's `useTranslations("Validation")`
// so they follow the active locale — see lib/schemas.ts for the same
// convention on the other (non-feature-foldered) forms.
type Translate = (key: string) => string;

const GENDERS = ["male", "female"] satisfies readonly z.infer<
  ReturnType<typeof genderSchema>
>[];

function genderSchema() {
  return z.enum(["male", "female"]);
}

const MAX_ATTACHMENT_SIZE = 1024 * 1024; // 1MB per image

function attachmentsSchema(t: Translate) {
  return z
    .array(
      z
        .instanceof(File)
        .refine((f) => f.type.startsWith("image/"), t("attachmentImageOnly"))
        .refine((f) => f.size <= MAX_ATTACHMENT_SIZE, t("attachmentTooLarge"))
    )
    .optional();
}

export function guardianSchema(t: Translate) {
  return z.object({
    name: z.string().min(1, t("guardianNameRequired")).max(255),
    job: z.string().min(1, t("guardianJobRequired")).max(255),
    national_id: z.string().min(1, t("guardianNationalIdRequired")).max(255),
    phone: z.string().min(1, t("guardianPhoneRequired")).max(255),
    nationality_id: z.string().min(1, t("nationalityRequired")),
    governorate_id: z.string().min(1, t("governorateRequired")),
    blood_type_id: z.string().min(1, t("bloodTypeRequired")),
    religion_id: z.string().min(1, t("religionRequired")),
    address: z.string().min(1, t("guardianAddressRequired")),
  });
}

export function createStudentWizardSchema(t: Translate) {
  return z.object({
    student: z
      .object({
        name_en: z.string().min(1, t("studentNameEnRequired")).max(255),
        name_ar: z.string().min(1, t("studentNameArRequired")).max(255),
        email: z.string().min(1, t("passwordRequired")).email(t("emailInvalid")),
        password: z.string().min(8, t("passwordMin")),
        password_confirmation: z.string().min(1, t("passwordRequired")),
        gender: genderSchema(),
        nationality_id: z.string().min(1, t("nationalityRequired")),
        governorate_id: z.string().min(1, t("governorateRequired")),
        blood_type_id: z.string().min(1, t("bloodTypeRequired")),
        stage_id: z.string().min(1, t("stageRequired")),
        grade_id: z.string().min(1, t("gradeRequired")),
        classroom_id: z.string().min(1, t("classroomRequired")),
        academic_year_id: z.string().min(1, t("academicYearRequired")),
      })
      .refine((s) => s.password === s.password_confirmation, {
        message: t("passwordsDontMatch"),
        path: ["password_confirmation"],
      }),
    parent: z
      .object({
        email: z.string().min(1, t("passwordRequired")).email(t("emailInvalid")),
        password: z.string().min(8, t("passwordMin")),
        password_confirmation: z.string().min(1, t("passwordRequired")),
      })
      .refine((p) => p.password === p.password_confirmation, {
        message: t("passwordsDontMatch"),
        path: ["password_confirmation"],
      }),
    father: guardianSchema(t),
    mother: guardianSchema(t),
    attachments: attachmentsSchema(t),
  });
}

export type StudentWizardValues = z.infer<
  ReturnType<typeof createStudentWizardSchema>
>;

export type Gender = (typeof GENDERS)[number];
export { GENDERS };

export const STEP_FIELDS: Record<number, Path<StudentWizardValues>[]> = {
  1: [
    "student.name_en",
    "student.name_ar",
    "student.email",
    "student.password",
    "student.password_confirmation",
    "student.gender",
    "student.nationality_id",
    "student.governorate_id",
    "student.blood_type_id",
  ],
  2: [
    "student.stage_id",
    "student.grade_id",
    "student.classroom_id",
    "student.academic_year_id",
  ],
  3: ["parent.email", "parent.password", "parent.password_confirmation"],
  4: [
    "father.name",
    "father.job",
    "father.national_id",
    "father.phone",
    "father.nationality_id",
    "father.governorate_id",
    "father.blood_type_id",
    "father.religion_id",
    "father.address",
  ],
  5: [
    "mother.name",
    "mother.job",
    "mother.national_id",
    "mother.phone",
    "mother.nationality_id",
    "mother.governorate_id",
    "mother.blood_type_id",
    "mother.religion_id",
    "mother.address",
  ],
  6: ["attachments"],
};

export const TOTAL_STEPS = 7;

export const defaultStudentWizardValues: StudentWizardValues = {
  student: {
    name_en: "",
    name_ar: "",
    email: "",
    password: "",
    password_confirmation: "",
    gender: "male",
    nationality_id: "",
    governorate_id: "",
    blood_type_id: "",
    stage_id: "",
    grade_id: "",
    classroom_id: "",
    academic_year_id: "",
  },
  parent: {
    email: "",
    password: "",
    password_confirmation: "",
  },
  father: {
    name: "",
    job: "",
    national_id: "",
    phone: "",
    nationality_id: "",
    governorate_id: "",
    blood_type_id: "",
    religion_id: "",
    address: "",
  },
  mother: {
    name: "",
    job: "",
    national_id: "",
    phone: "",
    nationality_id: "",
    governorate_id: "",
    blood_type_id: "",
    religion_id: "",
    address: "",
  },
  attachments: [],
};

export function toFormData(values: StudentWizardValues): FormData {
  const formData = new FormData();
  appendFormData(formData, toApiPayload(values));

  (values.attachments ?? []).forEach((file) => {
    formData.append("attachments[]", file);
  });

  return formData;
}

function appendFormData(formData: FormData, data: unknown, prefix = ""): void {
  if (data === null || data === undefined) return;

  if (Array.isArray(data)) {
    data.forEach((item, index) => appendFormData(formData, item, `${prefix}[${index}]`));
  } else if (typeof data === "object" && !(data instanceof File)) {
    Object.entries(data as Record<string, unknown>).forEach(([key, value]) => {
      appendFormData(formData, value, prefix ? `${prefix}[${key}]` : key);
    });
  } else {
    formData.append(prefix, data instanceof File ? data : String(data));
  }
}

// Admin edit form — unlike the wizard, passwords are optional (blank means
// "don't change it") and there's no attachments step; everything else
// mirrors the wizard's own fields/validation 1:1.
export function createEditStudentSchema(t: Translate) {
  return z.object({
    student: z
      .object({
        name_en: z.string().min(1, t("studentNameEnRequired")).max(255),
        name_ar: z.string().min(1, t("studentNameArRequired")).max(255),
        email: z.string().min(1, t("passwordRequired")).email(t("emailInvalid")),
        password: z.string().max(255).optional().or(z.literal("")),
        password_confirmation: z.string().optional().or(z.literal("")),
        gender: genderSchema(),
        nationality_id: z.string().min(1, t("nationalityRequired")),
        governorate_id: z.string().min(1, t("governorateRequired")),
        blood_type_id: z.string().min(1, t("bloodTypeRequired")),
        stage_id: z.string().min(1, t("stageRequired")),
        grade_id: z.string().min(1, t("gradeRequired")),
        classroom_id: z.string().min(1, t("classroomRequired")),
        academic_year_id: z.string().min(1, t("academicYearRequired")),
      })
      .refine((s) => !s.password || s.password.length >= 8, {
        message: t("passwordMin"),
        path: ["password"],
      })
      .refine((s) => s.password === s.password_confirmation, {
        message: t("passwordsDontMatch"),
        path: ["password_confirmation"],
      }),
    parent: z
      .object({
        email: z.string().min(1, t("passwordRequired")).email(t("emailInvalid")),
        password: z.string().max(255).optional().or(z.literal("")),
        password_confirmation: z.string().optional().or(z.literal("")),
      })
      .refine((p) => !p.password || p.password.length >= 8, {
        message: t("passwordMin"),
        path: ["password"],
      })
      .refine((p) => p.password === p.password_confirmation, {
        message: t("passwordsDontMatch"),
        path: ["password_confirmation"],
      }),
    father: guardianSchema(t),
    mother: guardianSchema(t),
  });
}

export type EditStudentValues = z.infer<ReturnType<typeof createEditStudentSchema>>;

function guardianDefaultsFromApi(
  g: Student["father"]
): EditStudentValues["father"] {
  return {
    name: g.name,
    job: g.job,
    national_id: g.national_id,
    phone: g.phone,
    nationality_id: String(g.nationality_id),
    governorate_id: String(g.governorate_id),
    blood_type_id: String(g.blood_type_id),
    religion_id: String(g.religion_id),
    address: g.address,
  };
}

export function editStudentDefaults(student: Student): EditStudentValues {
  return {
    student: {
      name_en: student.name_en,
      name_ar: student.name_ar,
      email: student.email,
      password: "",
      password_confirmation: "",
      gender: student.gender,
      nationality_id: String(student.nationality_id),
      governorate_id: String(student.governorate_id),
      blood_type_id: String(student.blood_type_id),
      stage_id: String(student.stage_id),
      grade_id: String(student.grade_id),
      classroom_id: String(student.classroom_id),
      academic_year_id: String(student.academic_year_id),
    },
    parent: {
      email: student.parent_email,
      password: "",
      password_confirmation: "",
    },
    father: guardianDefaultsFromApi(student.father),
    mother: guardianDefaultsFromApi(student.mother),
  };
}

export function toEditPayload(values: EditStudentValues) {
  return {
    student: {
      name: { en: values.student.name_en, ar: values.student.name_ar },
      email: values.student.email,
      password: values.student.password || undefined,
      password_confirmation: values.student.password_confirmation || undefined,
      gender: values.student.gender,
      nationality_id: Number(values.student.nationality_id),
      governorate_id: Number(values.student.governorate_id),
      blood_type_id: Number(values.student.blood_type_id),
      stage_id: Number(values.student.stage_id),
      grade_id: Number(values.student.grade_id),
      classroom_id: Number(values.student.classroom_id),
      academic_year_id: Number(values.student.academic_year_id),
    },
    parent: {
      email: values.parent.email,
      password: values.parent.password || undefined,
      password_confirmation: values.parent.password_confirmation || undefined,
    },
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

export function toApiPayload(values: StudentWizardValues) {
  return {
    student: {
      name: { en: values.student.name_en, ar: values.student.name_ar },
      email: values.student.email,
      password: values.student.password,
      password_confirmation: values.student.password_confirmation,
      gender: values.student.gender,
      nationality_id: Number(values.student.nationality_id),
      governorate_id: Number(values.student.governorate_id),
      blood_type_id: Number(values.student.blood_type_id),
      stage_id: Number(values.student.stage_id),
      grade_id: Number(values.student.grade_id),
      classroom_id: Number(values.student.classroom_id),
      academic_year_id: Number(values.student.academic_year_id),
    },
    parent: {
      email: values.parent.email,
      password: values.parent.password,
      password_confirmation: values.parent.password_confirmation,
    },
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
