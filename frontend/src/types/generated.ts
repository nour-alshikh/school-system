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
export type BloodTypeType = {
readonly id: number,
readonly name_en: string,
readonly name_ar: string,
readonly created_at: string,
readonly updated_at: string,
};
export type ClassroomType = {
readonly id: number,
readonly grade_id: number,
readonly name: string,
readonly capacity: number | null,
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
readonly parent_email: string,
readonly father: GuardianType,
readonly mother: GuardianType,
readonly attachment_urls: string[],
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
