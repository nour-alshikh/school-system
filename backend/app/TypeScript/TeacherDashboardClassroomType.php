<?php

namespace App\TypeScript;

use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/** One of a teacher's classrooms on their dashboard, with today's attendance. */
#[TypeScript]
final class TeacherDashboardClassroomType
{
    /**
     * @param  string[]  $subjects_en
     * @param  string[]  $subjects_ar
     */
    public function __construct(
        public readonly int $id,
        public readonly string $name,
        public readonly string $grade_name_en,
        public readonly string $grade_name_ar,
        /** The subjects this teacher teaches there. */
        public readonly array $subjects_en,
        public readonly array $subjects_ar,
        public readonly int $students_count,
        public readonly bool $marked_today,
        /** Present or late today. */
        public readonly int $present_today,
        public readonly int $absent_today,
    ) {}
}
