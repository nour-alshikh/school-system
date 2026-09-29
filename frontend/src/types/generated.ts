export type AcademicYearType = {
readonly id: number,
readonly year: number,
readonly name_en: string,
readonly name_ar: string,
readonly is_current: boolean,
readonly created_at: string,
readonly updated_at: string,
};
export type AdminDashboardType = {
readonly students_count: number,
readonly teachers_count: number,
readonly parents_count: number,
readonly classrooms_count: number,
readonly current_academic_year: number | null,
readonly fees_collected: string,
readonly fees_outstanding: string,
readonly attendance_present_today: number,
readonly attendance_marked_today: number,
readonly upcoming_meetings_count: number,
readonly library_resources_count: number,
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
export type AttendanceRecordType = {
readonly id: number,
readonly student_id: number,
readonly student_name_en: string,
readonly student_name_ar: string,
readonly date: string,
readonly status: AttendanceStatus,
readonly notes: string | null,
};
export type AttendanceRosterEntryType = {
readonly student_id: number,
readonly student_name_en: string,
readonly student_name_ar: string,
readonly attendance_id: number | null,
readonly status: AttendanceStatus | null,
readonly notes: string | null,
};
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type BloodTypeType = {
readonly id: number,
readonly name_en: string,
readonly name_ar: string,
readonly created_at: string,
readonly updated_at: string,
};
export type CalendarEventType = {
readonly id: number,
readonly title: string,
readonly description: string | null,
readonly date: string,
readonly created_by_name: string,
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
export type ExamAttemptStatus = 'in_progress' | 'submitted';
export type ExamDetailType = {
readonly id: number,
readonly title: string,
readonly type: ExamType,
readonly subject_id: number,
readonly grade_id: number,
readonly classroom_id: number | null,
readonly academic_year_id: number,
readonly subject: SubjectType,
readonly grade: GradeType,
readonly classroom: ClassroomType | null,
readonly academic_year: AcademicYearType,
readonly instructions: string | null,
readonly duration_minutes: number,
readonly opens_at: string,
readonly closes_at: string,
readonly status: ExamStatus,
readonly questions: ExamQuestionType[],
readonly total_marks: number,
readonly attempts_count: number,
readonly submitted_count: number,
readonly created_at: string,
readonly updated_at: string,
};
export type ExamQuestionOptionType = {
readonly id: number,
readonly text: string,
readonly is_correct: boolean,
readonly order: number,
};
export type ExamQuestionType = {
readonly id: number,
readonly text: string,
readonly marks: number,
readonly order: number,
readonly options: ExamQuestionOptionType[],
};
export type ExamResultEntryType = {
readonly student_id: number,
readonly student_name_en: string,
readonly student_name_ar: string,
readonly status: ExamAttemptStatus | null,
readonly score: number | null,
readonly submitted_at: string | null,
};
export type ExamStatus = 'draft' | 'published';
export type ExamTeachingAssignmentType = {
readonly classroom_id: number,
readonly classroom_name: string,
readonly subject_id: number,
readonly subject_name_en: string,
readonly subject_name_ar: string,
readonly grade_id: number,
readonly grade_name_en: string,
readonly grade_name_ar: string,
};
export type ExamType = 'exam' | 'quiz';
export type FeeChargeStatus = 'unpaid' | 'partial' | 'paid' | 'waived';
export type FeeChargeType = {
readonly id: number,
readonly student_id: number,
readonly fee_id: number,
readonly fee_name_en: string,
readonly fee_name_ar: string,
readonly academic_year_id: number,
readonly amount_due: string,
readonly amount_paid: string,
readonly status: FeeChargeStatus,
readonly payments: FeePaymentType[],
readonly created_at: string,
};
export type FeeMatchingStudentType = {
readonly id: number,
readonly name_en: string,
readonly name_ar: string,
};
export type FeePaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'other';
export type FeePaymentType = {
readonly id: number,
readonly amount: string,
readonly paid_at: string,
readonly method: FeePaymentMethod,
readonly note: string | null,
readonly recorded_by_name: string | null,
readonly created_at: string,
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
export type LibraryResourceKind = 'file' | 'link';
export type LibraryResourceSubjectType = {
readonly id: number,
readonly name_en: string,
readonly name_ar: string,
};
export type LibraryResourceType = {
readonly id: number,
readonly title: string,
readonly description: string | null,
readonly type: LibraryResourceKind,
readonly url: string | null,
readonly file: AttachmentType | null,
readonly grade_id: number,
readonly grade: GradeType,
readonly subject_ids: number[],
readonly subjects: LibraryResourceSubjectType[],
readonly uploader: PostAuthorType,
readonly created_at: string,
readonly updated_at: string,
};
export type MeetingClassroomType = {
readonly id: number,
readonly name: string,
};
export type MeetingType = {
readonly id: number,
readonly title: string,
readonly description: string | null,
readonly start_time: string,
readonly duration_minutes: number,
readonly join_url: string,
readonly start_url: string,
readonly created_by: number,
readonly creator_name: string,
readonly classrooms: MeetingClassroomType[],
};
export type MembershipRole = 'admin' | 'teacher' | 'parent' | 'student';
export type MembershipStatus = 'invited' | 'active' | 'suspended' | 'left';
export type NationalityType = {
readonly id: number,
readonly name_en: string,
readonly name_ar: string,
readonly created_at: string,
readonly updated_at: string,
};
export type ParentChildType = {
readonly student: StudentType,
readonly school_id: number,
readonly school_name: string,
readonly attendance: StudentAttendanceSummaryType,
readonly fees: StudentFeesSummaryType,
};
export type PlatformSchoolType = {
readonly id: number,
readonly name: string,
readonly slug: string,
readonly status: string,
readonly members_count: number,
readonly created_at: string,
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
export type SchoolMembershipType = {
readonly id: number,
readonly role: string,
readonly school_id: number,
readonly school_name: string,
};
export type SchoolSource = 'platform' | 'self_service' | 'seed';
export type SchoolStatus = 'active' | 'suspended';
export type SettingGroup = 'general' | 'branding' | 'contact' | 'social' | 'seo';
export type SettingType = {
readonly id: number,
readonly key: string,
readonly value: string | null,
readonly group: SettingGroup,
readonly file_url: string | null,
};
export type StageType = {
readonly id: number,
readonly name_en: string,
readonly name_ar: string,
readonly created_at: string,
readonly updated_at: string,
};
export type StudentAttendanceSummaryType = {
readonly present: number,
readonly absent: number,
readonly late: number,
readonly excused: number,
readonly total: number,
};
export type StudentClassSubjectType = {
readonly subject_id: number,
readonly subject_name_en: string,
readonly subject_name_ar: string,
readonly teacher_name: string | null,
readonly teacher_email: string | null,
readonly teacher_phone: string | null,
};
export type StudentDashboardType = {
readonly student: StudentType,
readonly attendance_summary: StudentAttendanceSummaryType,
readonly latest_attendance: AttendanceRecordType | null,
readonly subjects_count: number,
readonly fees_summary: StudentFeesSummaryType,
readonly exams_total: number,
readonly exams_pending_count: number,
readonly next_exam: StudentExamListEntryType | null,
};
export type StudentExamAttemptType = {
readonly attempt_id: number,
readonly exam_id: number,
readonly title: string,
readonly instructions: string | null,
readonly duration_minutes: number,
readonly remaining_seconds: number,
readonly questions: StudentExamQuestionType[],
};
export type StudentExamListEntryType = {
readonly id: number,
readonly title: string,
readonly type: ExamType,
readonly subject_name_en: string,
readonly subject_name_ar: string,
readonly duration_minutes: number,
readonly opens_at: string,
readonly closes_at: string,
readonly attempt_status: ExamAttemptStatus | null,
readonly score: number | null,
readonly total_marks: number,
};
export type StudentExamOptionType = {
readonly id: number,
readonly text: string,
};
export type StudentExamQuestionType = {
readonly id: number,
readonly text: string,
readonly marks: number,
readonly options: StudentExamOptionType[],
readonly selected_option_id: number | null,
};
export type StudentExamResultType = {
readonly score: number,
readonly total_marks: number,
readonly submitted_at: string,
};
export type StudentFeesSummaryType = {
readonly total_due: string,
readonly total_paid: string,
readonly total_outstanding: string,
};
export type StudentMeetingType = {
readonly id: number,
readonly title: string,
readonly description: string | null,
readonly start_time: string,
readonly duration_minutes: number,
readonly join_url: string,
readonly teacher_name: string,
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
export type TeacherClassroomStatusType = {
readonly classroom_id: number,
readonly classroom_name: string,
readonly grade_name_en: string,
readonly grade_name_ar: string,
readonly student_count: number,
readonly attendance_marked_today: boolean,
};
export type TeacherDashboardType = {
readonly teacher: TeacherType,
readonly classrooms_count: number,
readonly subjects_count: number,
readonly students_total: number,
readonly attendance_marked_count: number,
readonly exams_total: number,
readonly latest_exam: TeacherExamSummaryType | null,
};
export type TeacherExamSummaryType = {
readonly id: number,
readonly title: string,
readonly type: ExamType,
readonly status: ExamStatus,
readonly subject_name_en: string,
readonly subject_name_ar: string,
readonly opens_at: string,
readonly closes_at: string,
readonly submitted_count: number,
readonly eligible_count: number,
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
readonly has_login: boolean,
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
readonly is_platform_admin: boolean,
readonly current_membership: SchoolMembershipType | null,
readonly memberships: SchoolMembershipType[],
};
