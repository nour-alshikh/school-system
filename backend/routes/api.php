<?php

use App\Http\Controllers\AcademicYearController;
use App\Http\Controllers\Admin\DashboardController as AdminDashboardController;
use App\Http\Controllers\Admin\OnboardingController;
use App\Http\Controllers\Admin\SettingController as AdminSettingController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\AttachmentController;
use App\Http\Controllers\AttendanceController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\AvatarController;
use App\Http\Controllers\BloodTypeController;
use App\Http\Controllers\CalendarEventController;
use App\Http\Controllers\ClassroomController;
use App\Http\Controllers\ExamController;
use App\Http\Controllers\FeeChargeController;
use App\Http\Controllers\FeeController;
use App\Http\Controllers\GovernorateController;
use App\Http\Controllers\GradeController;
use App\Http\Controllers\GraduationController;
use App\Http\Controllers\LibraryResourceController;
use App\Http\Controllers\MeetingController;
use App\Http\Controllers\NationalityController;
use App\Http\Controllers\ParentPortal\AttendanceController as ParentAttendanceController;
use App\Http\Controllers\ParentPortal\FeeController as ParentFeeController;
use App\Http\Controllers\ParentPortal\LibraryController as ParentLibraryController;
use App\Http\Controllers\ParentPortal\ProfileController;
use App\Http\Controllers\ParentPortal\StudentController as ParentStudentController;
use App\Http\Controllers\Platform\DashboardController as PlatformDashboardController;
use App\Http\Controllers\Platform\MemberController as PlatformMemberController;
use App\Http\Controllers\Platform\SchoolController as PlatformSchoolController;
use App\Http\Controllers\Platform\SessionController as PlatformSessionController;
use App\Http\Controllers\PostController;
use App\Http\Controllers\PromotionController;
use App\Http\Controllers\ReligionController;
use App\Http\Controllers\SchoolSignupController;
use App\Http\Controllers\SettingController;
use App\Http\Controllers\StageController;
use App\Http\Controllers\StudentController;
use App\Http\Controllers\StudentPortal\AttendanceController as StudentAttendanceController;
use App\Http\Controllers\StudentPortal\DashboardController as StudentDashboardController;
use App\Http\Controllers\StudentPortal\ExamController as StudentExamController;
use App\Http\Controllers\StudentPortal\FeeController as StudentFeeController;
use App\Http\Controllers\StudentPortal\LibraryController as StudentLibraryController;
use App\Http\Controllers\StudentPortal\MeetingController as StudentMeetingController;
use App\Http\Controllers\StudentPortal\SubjectController as StudentSubjectController;
use App\Http\Controllers\SubjectController;
use App\Http\Controllers\TeacherController;
use App\Http\Controllers\TeacherPortal\ClassroomController as TeacherClassroomController;
use App\Http\Controllers\TeacherPortal\DashboardController as TeacherDashboardController;
use App\Http\Controllers\ZoomController;
use App\Models\Post;
use Illuminate\Support\Facades\Route;

Route::middleware('throttle:10,1')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/forgot-password', [PasswordResetController::class, 'forgotPassword']);
    Route::post('/reset-password', [PasswordResetController::class, 'resetPassword']);
});

// A system admin's second login step (docs/central-dashboard-plan.md,
// phase 1), with its own limiter (see AppServiceProvider).
Route::middleware('throttle:two-factor')->post('/login/two-factor', [AuthController::class, 'twoFactor']);

// Self-service schools (docs/self-service-schools-plan.md): anyone can
// create one. Signing up answers like login; the slug check is public so
// the form can show availability as the user types.
Route::middleware('throttle:school-signup')->post('/school-signup', [SchoolSignupController::class, 'signUp']);
Route::middleware('throttle:30,1')->get('/school-slugs/{slug}', [SchoolSignupController::class, 'slugAvailability']);

// Deliberately outside auth:sanctum — Zoom's redirect back here is a plain
// top-level browser navigation from zoom.us, which Sanctum's cookie-based
// "fromFrontend" check would never recognize as authenticated. See
// ZoomController::callback()'s doc comment for how it's secured instead.
Route::middleware('throttle:30,1')->get('/zoom/callback', [ZoomController::class, 'callback']);

// Public — the frontend needs branding (logo, school name, social links)
// before a user is authenticated at all (e.g. the login page header), so
// this deliberately sits outside auth:sanctum like /zoom/callback above.
// Nothing sensitive lives on this table; only writes need gating.
Route::get('/settings', [SettingController::class, 'index']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/switch-school', [AuthController::class, 'switchSchool']);
    Route::post('/schools', [SchoolSignupController::class, 'store'])->middleware('throttle:school-signup');

    // Student attachments: staff, the student, or their parent — checked in
    // the controller, since no single permission covers all three.
    Route::get('/attachments/{media}', [AttachmentController::class, 'show']);

    // A system admin leaving a school they entered (with that session's
    // own token, so not behind platform-admin).
    Route::post('/platform/exit', [PlatformSessionController::class, 'exit']);

    // Platform admin (users.is_platform_admin): manage the schools
    // themselves. See docs/multi-tenancy.md, step 8.
    Route::middleware('platform-admin')->prefix('platform')->group(function () {
        Route::post('/confirm', [PlatformSessionController::class, 'confirm'])->middleware('throttle:two-factor');
        Route::post('/schools/{school}/enter', [PlatformSessionController::class, 'enter']);
        Route::get('/overview', [PlatformDashboardController::class, 'overview']);
        // A school's admins and members (docs/central-dashboard-plan.md, phase 6).
        Route::get('/schools/{school}/members', [PlatformMemberController::class, 'index']);
        Route::post('/schools/{school}/admins', [PlatformMemberController::class, 'addAdmin']);
        Route::delete('/schools/{school}/admins/{user}', [PlatformMemberController::class, 'removeAdmin']);
        Route::patch('/schools/{school}/members/{membership}', [PlatformMemberController::class, 'update']);
        Route::post('/schools/{school}/members/{membership}/password-reset', [PlatformMemberController::class, 'sendPasswordReset']);
        Route::get('/schools/{school}', [PlatformDashboardController::class, 'school']);
        Route::get('/audit-logs', [PlatformDashboardController::class, 'auditLogs']);
        Route::get('/schools', [PlatformSchoolController::class, 'index']);
        Route::post('/schools', [PlatformSchoolController::class, 'store']);
        Route::patch('/schools/{school}', [PlatformSchoolController::class, 'update']);
    });
    Route::get('/user', [AuthController::class, 'user']);

    Route::post('/user/avatar', [AvatarController::class, 'store']);
    Route::delete('/user/avatar', [AvatarController::class, 'destroy']);

    Route::middleware('permission:manage-users')->group(function () {
        Route::get('/admin/users', [UserController::class, 'index']);
    });

    Route::get('/posts', [PostController::class, 'index']);
    Route::post('/posts', [PostController::class, 'store'])->middleware('can:create,'.Post::class);
    Route::put('/posts/{post}', [PostController::class, 'update'])->middleware('can:update,post');
    Route::delete('/posts/{post}', [PostController::class, 'destroy'])->middleware('can:delete,post');

    // The academic structure (stages, grades, classrooms, academic years) is
    // admin territory: read access is shared by whichever admin permission
    // needs it (managing the structure itself, or picking values while
    // registering a student), writes need manage-academics specifically.
    // Parents/students get none of this — just their own record.
    Route::middleware('permission:manage-academics|manage-students')->group(function () {
        Route::get('/stages', [StageController::class, 'index']);
        Route::get('/grades', [GradeController::class, 'index']);
        Route::get('/classrooms', [ClassroomController::class, 'index']);
        Route::get('/academic-years', [AcademicYearController::class, 'index']);
        Route::get('/subjects', [SubjectController::class, 'index']);
    });
    Route::middleware('permission:manage-academics')->group(function () {
        Route::post('/stages', [StageController::class, 'store']);
        Route::post('/stages/bulk-delete', [StageController::class, 'bulkDestroy']);
        Route::put('/stages/{stage}', [StageController::class, 'update']);
        Route::delete('/stages/{stage}', [StageController::class, 'destroy']);

        Route::post('/grades', [GradeController::class, 'store']);
        Route::post('/grades/bulk-delete', [GradeController::class, 'bulkDestroy']);
        Route::put('/grades/{grade}', [GradeController::class, 'update']);
        Route::delete('/grades/{grade}', [GradeController::class, 'destroy']);

        Route::post('/classrooms', [ClassroomController::class, 'store']);
        Route::post('/classrooms/bulk-delete', [ClassroomController::class, 'bulkDestroy']);
        Route::put('/classrooms/{classroom}', [ClassroomController::class, 'update']);
        Route::put('/classrooms/{classroom}/subject-teachers', [ClassroomController::class, 'updateSubjectTeachers']);
        Route::delete('/classrooms/{classroom}', [ClassroomController::class, 'destroy']);

        Route::post('/academic-years', [AcademicYearController::class, 'store']);
        Route::post('/academic-years/bulk-delete', [AcademicYearController::class, 'bulkDestroy']);
        Route::put('/academic-years/{academicYear}', [AcademicYearController::class, 'update']);
        Route::delete('/academic-years/{academicYear}', [AcademicYearController::class, 'destroy']);

        Route::post('/subjects', [SubjectController::class, 'store']);
        Route::post('/subjects/bulk-delete', [SubjectController::class, 'bulkDestroy']);
        Route::put('/subjects/{subject}', [SubjectController::class, 'update']);
        Route::delete('/subjects/{subject}', [SubjectController::class, 'destroy']);
    });

    // Fees are their own admin territory, separate from the academic
    // structure and from manage-students — a registrar managing fee amounts
    // doesn't need (and shouldn't get) write access to stages/grades/students.
    Route::middleware('permission:manage-fees')->group(function () {
        Route::get('/fees', [FeeController::class, 'index']);
        Route::post('/fees', [FeeController::class, 'store']);
        Route::post('/fees/bulk-delete', [FeeController::class, 'bulkDestroy']);
        Route::put('/fees/{fee}', [FeeController::class, 'update']);
        Route::delete('/fees/{fee}', [FeeController::class, 'destroy']);
        Route::get('/fees/{fee}/matching-students', [FeeController::class, 'matchingStudents']);
        Route::post('/fees/{fee}/charge-all', [FeeController::class, 'chargeAll']);

        // Billing lives here rather than under manage-students, since it's
        // the same admin territory that owns the fee catalog — see
        // Fee::charges()/FeeCharge.
        Route::get('/students/{student}/fee-charges', [FeeChargeController::class, 'index']);
        Route::post('/students/{student}/fee-charges', [FeeChargeController::class, 'store']);
        Route::put('/fee-charges/{feeCharge}', [FeeChargeController::class, 'update']);
        Route::delete('/fee-charges/{feeCharge}', [FeeChargeController::class, 'destroy']);
        Route::post('/fee-charges/{feeCharge}/waive', [FeeChargeController::class, 'waive']);
        Route::post('/fee-charges/{feeCharge}/unwaive', [FeeChargeController::class, 'unwaive']);
        Route::post('/fee-charges/{feeCharge}/payments', [FeeChargeController::class, 'storePayment']);
    });

    // Teachers are their own admin territory, separate from the academic
    // structure — manage-teachers only, no sharing with manage-academics or
    // manage-students. The one exception is reading the list: assigning a
    // classroom subject to a teacher (manage-academics territory) needs
    // teacher names to populate that picker.
    Route::middleware('permission:manage-academics|manage-teachers')->group(function () {
        Route::get('/teachers', [TeacherController::class, 'index']);
    });
    Route::middleware('permission:manage-teachers')->group(function () {
        Route::post('/teachers', [TeacherController::class, 'store']);
        Route::post('/teachers/bulk-delete', [TeacherController::class, 'bulkDestroy']);
        Route::put('/teachers/{teacher}', [TeacherController::class, 'update']);
        Route::put('/teachers/{teacher}/subjects', [TeacherController::class, 'updateSubjects']);
        Route::delete('/teachers/{teacher}', [TeacherController::class, 'destroy']);
    });

    Route::middleware('permission:manage-students')->group(function () {
        Route::get('/students', [StudentController::class, 'index']);
        Route::post('/students', [StudentController::class, 'store']);
        Route::get('/students/{student}', [StudentController::class, 'show']);
        Route::put('/students/{student}', [StudentController::class, 'update']);
        Route::delete('/students/{student}', [StudentController::class, 'destroy']);
        Route::post('/students/{student}/attachments', [StudentController::class, 'storeAttachments']);
        Route::get('/students/{student}/attachments/{media}/download', [StudentController::class, 'downloadAttachment']);
        Route::delete('/students/{student}/attachments/{media}', [StudentController::class, 'destroyAttachment']);

        Route::get('/promotions', [PromotionController::class, 'index']);
        Route::post('/promotions', [PromotionController::class, 'store']);
        Route::post('/promotions/rollback', [PromotionController::class, 'rollback']);

        Route::get('/graduations', [GraduationController::class, 'index']);
        Route::post('/graduations', [GraduationController::class, 'store']);
        Route::post('/graduations/rollback', [GraduationController::class, 'rollback']);
    });

    // Attendance is shared between admin (manage-attendance, any classroom)
    // and the teacher role (only classrooms they hold a subject slot in) —
    // that per-classroom split can't be expressed by route middleware
    // alone, so AttendanceController checks it directly. See
    // AttendanceController::authorizeClassroom().
    Route::middleware('role_or_permission:teacher|manage-attendance')->group(function () {
        Route::get('/attendance/classrooms', [AttendanceController::class, 'classrooms']);
        Route::get('/classrooms/{classroom}/attendance', [AttendanceController::class, 'index']);
        Route::post('/classrooms/{classroom}/attendance', [AttendanceController::class, 'store']);
        Route::get('/classrooms/{classroom}/attendance/history', [AttendanceController::class, 'history']);
    });

    // A parent's self-service corner: their own account, and the children
    // linked to it — at every school they are a parent at (ParentChildren),
    // nothing else. No manage-students permission needed or granted; scoped
    // entirely by role + ownership.
    Route::middleware('role:parent')->group(function () {
        Route::put('/parent/profile', [ProfileController::class, 'update']);
        Route::get('/parent/children', [ParentStudentController::class, 'index']);
        Route::get('/parent/student', [ParentStudentController::class, 'show']);
        Route::put('/parent/student', [ParentStudentController::class, 'update']);
        Route::get('/parent/library-resources', [ParentLibraryController::class, 'index']);
        Route::get('/parent/fees', [ParentFeeController::class, 'index']);
        Route::get('/parent/attendance', [ParentAttendanceController::class, 'index']);
    });

    // Exams/quizzes are shared between admin (manage-exams, any grade or
    // classroom) and the teacher role (only classroom+subject combinations
    // they hold via ClassroomSubjectTeacher) — same split as attendance,
    // enforced in ExamController since route middleware alone can't express
    // the per-classroom scoping. See ExamController::authorizeTarget().
    Route::middleware('role_or_permission:teacher|manage-exams')->group(function () {
        Route::get('/exams', [ExamController::class, 'index']);
        Route::get('/exams/teaching-assignments', [ExamController::class, 'teachingAssignments']);
        Route::post('/exams', [ExamController::class, 'store']);
        Route::get('/exams/{exam}', [ExamController::class, 'show']);
        Route::put('/exams/{exam}', [ExamController::class, 'update']);
        Route::delete('/exams/{exam}', [ExamController::class, 'destroy']);
        Route::get('/exams/{exam}/results', [ExamController::class, 'results']);
    });

    // Meetings are shared between admin (manage-meetings, any classroom) and
    // the teacher role (only classrooms they hold a subject slot in) — same
    // split as attendance/exams, enforced in MeetingController since route
    // middleware alone can't express the per-classroom scoping.
    Route::middleware('role_or_permission:teacher|manage-meetings')->group(function () {
        Route::get('/meetings/classrooms', [MeetingController::class, 'classrooms']);
        Route::get('/meetings', [MeetingController::class, 'index']);
        Route::post('/meetings', [MeetingController::class, 'store']);
        Route::delete('/meetings/{meeting}', [MeetingController::class, 'destroy']);

        // Read-only: a teacher can't connect/disconnect the shared Zoom
        // account (see the manage-meetings-only group below) but still
        // needs to know whether one exists before trying to schedule.
        Route::get('/zoom/status', [ZoomController::class, 'status']);
    });

    // Managing the one shared Zoom account (connect/disconnect) is admin
    // territory — see ZoomService's class doc for why it's one shared
    // account rather than per-teacher Zoom logins. callback() itself lives
    // outside auth:sanctum entirely — see the top of this file.
    Route::middleware('permission:manage-meetings')->group(function () {
        Route::get('/zoom/connect-url', [ZoomController::class, 'connectUrl']);
        Route::delete('/zoom/connection', [ZoomController::class, 'disconnect']);
    });

    // Library resources are grade-level (not per-classroom — see
    // Subject::stages()/grades() for the same "shared across a grade's
    // classrooms" idea) and subject-tagged. Shared between admin
    // (manage-academics, any grade) and the teacher role (only grades they
    // hold a subject slot in) — same split as attendance/exams/meetings,
    // enforced in LibraryResourceController since route middleware alone
    // can't express the per-grade scoping.
    Route::middleware('role_or_permission:teacher|manage-academics')->group(function () {
        Route::get('/library-resources/grades', [LibraryResourceController::class, 'grades']);
        Route::get('/library-resources/subjects', [LibraryResourceController::class, 'subjects']);
        Route::get('/library-resources', [LibraryResourceController::class, 'index']);
        Route::post('/library-resources', [LibraryResourceController::class, 'store']);
        Route::put('/library-resources/{libraryResource}', [LibraryResourceController::class, 'update']);
        Route::post('/library-resources/{libraryResource}/file', [LibraryResourceController::class, 'updateFile']);
        Route::delete('/library-resources/{libraryResource}', [LibraryResourceController::class, 'destroy']);
    });

    // Downloading a resource's file is shared by every role that can see it
    // (admin, teacher, student, parent) — LibraryResourceController::
    // download() does the per-role grade check itself since route
    // middleware can't express it across four different roles at once.
    Route::get('/library-resources/{libraryResource}/download', [LibraryResourceController::class, 'download']);

    // A student's self-service corner, same shape as the role:parent block
    // above — their own eligible exams, taking one, and submitting it.
    Route::middleware('role:student')->group(function () {
        Route::get('/student/dashboard', [StudentDashboardController::class, 'show']);
        Route::get('/student/attendance', [StudentAttendanceController::class, 'index']);
        Route::get('/student/subjects', [StudentSubjectController::class, 'index']);
        Route::get('/student/fees', [StudentFeeController::class, 'index']);
        Route::get('/student/exams', [StudentExamController::class, 'index']);
        Route::get('/student/exams/{exam}', [StudentExamController::class, 'show']);
        Route::post('/student/exams/{exam}/submit', [StudentExamController::class, 'submit']);
        Route::get('/student/meetings', [StudentMeetingController::class, 'index']);
        Route::get('/student/library-resources', [StudentLibraryController::class, 'index']);
    });

    // A teacher's self-service landing page — their own assignments,
    // classroom attendance status, and recent exams. Same shape as the
    // role:student block above.
    Route::middleware('role:teacher')->group(function () {
        Route::get('/teacher/dashboard', [TeacherDashboardController::class, 'show']);
        Route::get('/teacher/classrooms', [TeacherClassroomController::class, 'index']);
    });

    Route::middleware('permission:manage-settings')->group(function () {
        Route::put('/settings', [AdminSettingController::class, 'update']);
        Route::post('/settings/{setting:key}/file', [AdminSettingController::class, 'updateFile']);
    });

    Route::middleware('role:admin')->group(function () {
        Route::get('/admin/dashboard', [AdminDashboardController::class, 'show']);

        // A new school's setup checklist (docs/self-service-schools-plan.md).
        Route::get('/admin/onboarding', [OnboardingController::class, 'show']);

        // What system admins did in this school (docs/central-dashboard-plan.md, phase 5).
        Route::get('/admin/system-admin-activity', [PlatformSessionController::class, 'schoolActivity']);
        Route::post('/admin/onboarding/dismiss', [OnboardingController::class, 'dismiss']);
        Route::post('/admin/onboarding/standard-structure', [OnboardingController::class, 'standardStructure']);
    });

    // Reading the calendar is shared more broadly than managing it —
    // teachers, parents, and students all need to see school-wide events
    // (exam windows, holidays) on their own dashboards even though only
    // manage-calendar can add/edit/remove them.
    Route::middleware('role_or_permission:teacher|parent|student|manage-calendar')->group(function () {
        Route::get('/calendar-events', [CalendarEventController::class, 'index']);
    });
    Route::middleware('permission:manage-calendar')->group(function () {
        Route::post('/calendar-events', [CalendarEventController::class, 'store']);
        Route::put('/calendar-events/{calendarEvent}', [CalendarEventController::class, 'update']);
        Route::delete('/calendar-events/{calendarEvent}', [CalendarEventController::class, 'destroy']);
    });

    Route::get('/nationalities', [NationalityController::class, 'index']);
    Route::get('/governorates', [GovernorateController::class, 'index']);
    Route::get('/blood-types', [BloodTypeController::class, 'index']);
    Route::get('/religions', [ReligionController::class, 'index']);
});
