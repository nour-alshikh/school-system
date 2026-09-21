<?php

namespace App\TypeScript;

use App\Enums\AttendanceStatus;
use Illuminate\Support\Collection;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class StudentAttendanceSummaryType
{
    public function __construct(
        public readonly int $present,
        public readonly int $absent,
        public readonly int $late,
        public readonly int $excused,
        public readonly int $total,
    ) {}

    /**
     * @param  Collection<int, \App\Models\Attendance>  $records
     */
    public static function fromRecords(Collection $records): self
    {
        $counts = $records->countBy(fn ($record) => $record->status->value);

        return new self(
            present: $counts->get(AttendanceStatus::Present->value, 0),
            absent: $counts->get(AttendanceStatus::Absent->value, 0),
            late: $counts->get(AttendanceStatus::Late->value, 0),
            excused: $counts->get(AttendanceStatus::Excused->value, 0),
            total: $records->count(),
        );
    }
}
