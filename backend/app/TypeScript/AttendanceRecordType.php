<?php

namespace App\TypeScript;

use App\Enums\AttendanceStatus;
use App\Models\Attendance;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/**
 * One saved row for the history screen — unlike AttendanceRosterEntryType
 * (one student, possibly unmarked, for a single date), this is always a
 * real Attendance record and always carries its own date, since a history
 * listing spans a range rather than one day.
 */
#[TypeScript]
final class AttendanceRecordType
{
    public function __construct(
        public readonly int $id,
        public readonly int $student_id,
        public readonly string $student_name_en,
        public readonly string $student_name_ar,
        public readonly string $date,
        public readonly AttendanceStatus $status,
        public readonly ?string $notes,
    ) {}

    public static function fromModel(Attendance $attendance): self
    {
        return new self(
            id: $attendance->id,
            student_id: $attendance->student_id,
            student_name_en: $attendance->student->getTranslation('name', 'en'),
            student_name_ar: $attendance->student->getTranslation('name', 'ar'),
            date: $attendance->date->toDateString(),
            status: $attendance->status,
            notes: $attendance->notes,
        );
    }
}
