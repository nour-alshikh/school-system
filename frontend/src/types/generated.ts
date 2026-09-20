export type AcademicYearType = {
readonly id: number,
readonly year: number,
readonly name_en: string,
readonly name_ar: string,
readonly is_current: boolean,
readonly created_at: string,
readonly updated_at: string,
};
export type AdminUserType = {
readonly id: number,
readonly name: string,
readonly email: string,
readonly roles: RoleType[],
};
export type AttachmentType = {
readonly id: number,
readonly url: string,
readonly name: string,
};
export type BloodTypeType = {
readonly id: number,
readonly name_en: string,
readonly name_ar: string,
readonly created_at: string,
readonly updated_at: string,
};
export type ClassroomSubjectTeacherType = {
readonly subject_id: number,
readonly teacher_id: number | null,
};
export type ClassroomType = {
readonly id: number,
readonly grade_id: number,
readonly name: string,
readonly capacity: number | null,
readonly subject_teachers: ClassroomSubjectTeacherType[],
readonly created_at: string,
readonly updated_at: string,
};
export type FeeType = {
readonly id: number,
readonly name_en: string,
readonly name_ar: string,
readonly academic_year_id: number,
readonly amount: string,
readonly is_active: boolean,
readonly is_for_all: boolean,
readonly stage_id: number | null,
readonly grade_id: number | null,
readonly created_at: string,
readonly updated_at: string,
};
export type Gender = 'male' | 'female';
export type GovernorateType = {
readonly id: number,
readonly nationality_id: number,
readonly name_en: string,
readonly name_ar: string,
readonly created_at: string,
readonly updated_at: string,
};
export type GradeType = {
readonly id: number,
readonly stage_id: number,
readonly name_en: string,
readonly name_ar: string,
readonly created_at: string,
readonly updated_at: string,
};
export type GraduationType = {
readonly id: number,
readonly student_id: number,
readonly student_name_en: string,
readonly student_name_ar: string,
readonly stage: StageType,
readonly grade: GradeType,
readonly classroom: ClassroomType,
readonly academic_year: AcademicYearType,
readonly graduated_by_name: string | null,
readonly created_at: string,
readonly rolled_back_at: string | null,
readonly rolled_back_by_name: string | null,
};
export type GuardianType = {
readonly name: string,
readonly job: string,
readonly national_id: string,
readonly phone: string,
readonly nationality_id: number,
readonly governorate_id: number,
readonly blood_type_id: number,
readonly religion_id: number,
readonly address: string,
};
export type NationalityType = {
readonly id: number,
readonly name_en: string,
readonly name_ar: string,
readonly created_at: string,
readonly updated_at: string,
};
export type PostAuthorType = {
readonly id: number,
readonly name: string,
};
export type PostCategory = 'general' | 'tutorial' | 'news' | 'opinion';
export type PostStatus = 'draft' | 'published';
export type PostTag = 'laravel' | 'nextjs' | 'typescript' | 'react' | 'php' | 'testing';
export type PostType = {
readonly id: number,
readonly title: string,
readonly body: string,
readonly status: PostStatus,
readonly category: PostCategory,
readonly tags: PostTag[],
readonly is_featured: boolean,
readonly reading_minutes: number | null,
readonly priority: number,
readonly published_at: string | null,
readonly user: PostAuthorType,
readonly created_at: string,
readonly updated_at: string,
};
export type PromotionType = {
readonly id: number,
readonly student_id: number,
readonly student_name_en: string,
readonly student_name_ar: string,
readonly from_stage: StageType,
readonly from_grade: GradeType,
readonly from_classroom: ClassroomType,
readonly from_academic_year: AcademicYearType,
readonly to_stage: StageType,
readonly to_grade: GradeType,
readonly to_classroom: ClassroomType,
readonly to_academic_year: AcademicYearType,
readonly promoted_by_name: string | null,
readonly created_at: string,
readonly rolled_back_at: string | null,
readonly rolled_back_by_name: string | null,
};
export type ReligionType = {
readonly id: number,
readonly name_en: string,
readonly name_ar: string,
readonly created_at: string,
readonly updated_at: string,
};
export type RoleType = {
readonly id: number,
readonly name: string,
};
export type StageType = {
readonly id: number,
readonly name_en: string,
readonly name_ar: string,
readonly created_at: string,
readonly updated_at: string,
};
export type StudentStatus = 'active' | 'graduated';
export type StudentType = {
readonly id: number,
readonly name_en: string,
readonly name_ar: string,
readonly email: string,
readonly gender: Gender,
readonly nationality_id: number,
readonly governorate_id: number,
readonly blood_type_id: number,
readonly stage_id: number,
readonly grade_id: number,
readonly classroom_id: number,
readonly academic_year_id: number,
readonly status: StudentStatus,
readonly nationality: NationalityType,
readonly governorate: GovernorateType,
readonly blood_type: BloodTypeType,
readonly stage: StageType,
readonly grade: GradeType,
readonly classroom: ClassroomType,
readonly academic_year: AcademicYearType,
readonly parent_email: string,
readonly father: GuardianType,
readonly mother: GuardianType,
readonly attachments: AttachmentType[],
readonly created_at: string,
readonly updated_at: string,
};
export type SubjectType = {
readonly id: number,
readonly name_en: string,
readonly name_ar: string,
readonly stage_ids: number[],
readonly grade_ids: number[],
readonly created_at: string,
readonly updated_at: string,
};
export type TeacherStatus = 'active' | 'inactive' | 'on_leave';
export type TeacherType = {
readonly id: number,
readonly name: string,
readonly email: string,
readonly phone: string | null,
readonly joining_date: string,
readonly status: TeacherStatus,
readonly subject_ids: number[],
readonly created_at: string,
readonly updated_at: string,
};
export type UserType = {
readonly id: number,
readonly name: string,
readonly email: string,
readonly email_verified_at: string | null,
readonly created_at: string,
readonly updated_at: string,
readonly roles: string[],
readonly permissions: string[],
readonly avatar_url: string | null,
};
