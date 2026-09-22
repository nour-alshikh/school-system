<?php

namespace App\TypeScript;

use App\Enums\AttendanceStatus;
use App\Enums\FeeChargeStatus;
use App\Enums\StudentStatus;
use App\Enums\TeacherStatus;
use App\Models\AcademicYear;
use App\Models\Attendance;
use App\Models\Classroom;
use App\Models\FeeCharge;
use App\Models\FeePayment;
use App\Models\LibraryResource;
use App\Models\Meeting;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/**
 * The admin dashboard's landing summary — aggregate counts only, each a
 * cheap query. Full listings live behind their own pages/endpoints.
 */
#[TypeScript]
final class AdminDashboardType
{
    public function __construct(
        public readonly int $students_count,
        public readonly int $teachers_count,
        public readonly int $parents_count,
        public readonly int $classrooms_count,
        public readonly ?int $current_academic_year,
        public readonly string $fees_collected,
        public readonly string $fees_outstanding,
        public readonly int $attendance_present_today,
        public readonly int $attendance_marked_today,
        public readonly int $upcoming_meetings_count,
        public readonly int $library_resources_count,
    ) {}

    public static function build(): self
    {
        $totalDue = (float) FeeCharge::where('status', '!=', FeeChargeStatus::Waived)->sum('amount_due');
        $collected = (float) FeePayment::sum('amount');

        return new self(
            students_count: Student::where('status', StudentStatus::Active)->count(),
            teachers_count: Teacher::where('status', TeacherStatus::Active)->count(),
            parents_count: User::role('parent')->count(),
            classrooms_count: Classroom::count(),
            current_academic_year: AcademicYear::where('is_current', true)->value('year'),
            fees_collected: number_format($collected, 2, '.', ''),
            fees_outstanding: number_format(max(0, $totalDue - $collected), 2, '.', ''),
            attendance_present_today: Attendance::whereDate('date', today())
                ->where('status', AttendanceStatus::Present)
                ->count(),
            attendance_marked_today: Attendance::whereDate('date', today())->count(),
            upcoming_meetings_count: Meeting::where('start_time', '>=', now())->count(),
            library_resources_count: LibraryResource::count(),
        );
    }
}
