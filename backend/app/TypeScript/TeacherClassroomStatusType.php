<?php

namespace App\TypeScript;

use App\Models\Classroom;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class TeacherClassroomStatusType
{
    public function __construct(
        public readonly int $classroom_id,
        public readonly string $classroom_name,
        public readonly string $grade_name_en,
        public readonly string $grade_name_ar,
        public readonly int $student_count,
        public readonly bool $attendance_marked_today,
    ) {}

    public static function build(Classroom $classroom, int $studentCount, bool $attendanceMarkedToday): self
    {
        return new self(
            classroom_id: $classroom->id,
            classroom_name: $classroom->name,
            grade_name_en: $classroom->grade->getTranslation('name', 'en'),
            grade_name_ar: $classroom->grade->getTranslation('name', 'ar'),
            student_count: $studentCount,
            attendance_marked_today: $attendanceMarkedToday,
        );
    }
}
