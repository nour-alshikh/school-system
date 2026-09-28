<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Step 2 of docs/multi-tenancy.md: tag every school-owned row with the
     * school it belongs to. Nullable for now and backfilled with the one
     * existing school; step 4 makes it NOT NULL and composite-keyed.
     *
     * Child/pivot tables get it too even though it's derivable through the
     * parent — that redundancy is what lets step 4's composite foreign keys
     * make cross-school references impossible.
     */
    private const TABLES = [
        // Academics
        'stages', 'grades', 'classrooms', 'subjects', 'subject_stage', 'subject_grade',
        'academic_years', 'settings', 'calendar_events', 'posts',
        // Staff
        'teachers', 'subject_teacher', 'classroom_subject_teacher',
        // Students
        'students', 'fathers', 'mothers', 'promotions', 'graduations', 'attendances',
        // Fees
        'fees', 'fee_charges', 'fee_payments',
        // Exams
        'exams', 'exam_questions', 'exam_question_options', 'exam_attempts', 'exam_attempt_answers',
        // Meetings & library
        'meetings', 'meeting_classroom', 'zoom_connections', 'library_resources', 'library_resource_subject',
        // Media is polymorphic: rows owned by a global User (avatars) stay
        // null, so this column remains nullable there even after step 4.
        'media',
    ];

    public function up(): void
    {
        $schoolId = DB::table('schools')->orderBy('id')->value('id')
            ?? throw new RuntimeException('No school found — run the step 1 migrations first.');

        foreach (self::TABLES as $name) {
            $hasId = Schema::hasColumn($name, 'id');

            Schema::table($name, function (Blueprint $table) use ($hasId) {
                $column = $table->foreignId('school_id')->nullable();

                if ($hasId) {
                    $column->after('id');
                }

                $column->constrained()->restrictOnDelete();
            });

            DB::table($name)
                ->whereNull('school_id')
                ->when($name === 'media', fn ($q) => $q->where('model_type', '!=', 'App\\Models\\User'))
                ->update(['school_id' => $schoolId]);
        }
    }

    public function down(): void
    {
        foreach (array_reverse(self::TABLES) as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->dropConstrainedForeignId('school_id');
            });
        }
    }
};
