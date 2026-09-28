<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Step 4 of docs/multi-tenancy.md: school_id becomes required, and every
     * foreign key between school-owned tables includes it —
     * (school_id, classroom_id) -> classrooms(school_id, id) — so the
     * database itself rejects a row pointing at another school's record.
     */

    /** Tables whose school_id becomes NOT NULL. `media` is left out: avatars of global users keep it null. */
    private const TABLES = [
        'stages', 'grades', 'classrooms', 'subjects', 'subject_stage', 'subject_grade',
        'academic_years', 'settings', 'calendar_events', 'posts',
        'teachers', 'subject_teacher', 'classroom_subject_teacher',
        'students', 'fathers', 'mothers', 'promotions', 'graduations', 'attendances',
        'fees', 'fee_charges', 'fee_payments',
        'exams', 'exam_questions', 'exam_question_options', 'exam_attempts', 'exam_attempt_answers',
        'meetings', 'meeting_classroom', 'zoom_connections', 'library_resources', 'library_resource_subject',
    ];

    /**
     * table => [column => [referenced table, on delete]]. Matches the
     * existing single-column keys one for one.
     *
     * Not converted: exam_attempt_answers.selected_option_id is ON DELETE
     * SET NULL, and a composite key would null school_id along with it.
     * It keeps its plain key; BelongsToSchool scoping still applies to it.
     */
    private const FOREIGN_KEYS = [
        'grades' => ['stage_id' => ['stages', 'restrict']],
        'classrooms' => ['grade_id' => ['grades', 'restrict']],
        'subject_stage' => ['subject_id' => ['subjects', 'cascade'], 'stage_id' => ['stages', 'cascade']],
        'subject_grade' => ['subject_id' => ['subjects', 'cascade'], 'grade_id' => ['grades', 'cascade']],
        'subject_teacher' => ['subject_id' => ['subjects', 'cascade'], 'teacher_id' => ['teachers', 'cascade']],
        'classroom_subject_teacher' => [
            'classroom_id' => ['classrooms', 'cascade'],
            'subject_id' => ['subjects', 'cascade'],
            'teacher_id' => ['teachers', 'cascade'],
        ],
        'students' => [
            'stage_id' => ['stages', 'restrict'],
            'grade_id' => ['grades', 'restrict'],
            'classroom_id' => ['classrooms', 'restrict'],
            'academic_year_id' => ['academic_years', 'restrict'],
        ],
        'fathers' => ['student_id' => ['students', 'cascade']],
        'mothers' => ['student_id' => ['students', 'cascade']],
        'promotions' => [
            'student_id' => ['students', 'cascade'],
            'from_stage_id' => ['stages', 'restrict'],
            'from_grade_id' => ['grades', 'restrict'],
            'from_classroom_id' => ['classrooms', 'restrict'],
            'from_academic_year_id' => ['academic_years', 'restrict'],
            'to_stage_id' => ['stages', 'restrict'],
            'to_grade_id' => ['grades', 'restrict'],
            'to_classroom_id' => ['classrooms', 'restrict'],
            'to_academic_year_id' => ['academic_years', 'restrict'],
        ],
        'graduations' => [
            'student_id' => ['students', 'cascade'],
            'stage_id' => ['stages', 'restrict'],
            'grade_id' => ['grades', 'restrict'],
            'classroom_id' => ['classrooms', 'restrict'],
            'academic_year_id' => ['academic_years', 'restrict'],
        ],
        'attendances' => [
            'student_id' => ['students', 'cascade'],
            'classroom_id' => ['classrooms', 'restrict'],
            'academic_year_id' => ['academic_years', 'restrict'],
        ],
        'fees' => [
            'academic_year_id' => ['academic_years', 'cascade'],
            'stage_id' => ['stages', 'cascade'],
            'grade_id' => ['grades', 'cascade'],
        ],
        'fee_charges' => [
            'student_id' => ['students', 'cascade'],
            'fee_id' => ['fees', 'restrict'],
            'academic_year_id' => ['academic_years', 'restrict'],
        ],
        'fee_payments' => ['fee_charge_id' => ['fee_charges', 'cascade']],
        'exams' => [
            'subject_id' => ['subjects', 'restrict'],
            'grade_id' => ['grades', 'restrict'],
            'classroom_id' => ['classrooms', 'restrict'],
            'academic_year_id' => ['academic_years', 'restrict'],
        ],
        'exam_questions' => ['exam_id' => ['exams', 'cascade']],
        'exam_question_options' => ['question_id' => ['exam_questions', 'cascade']],
        'exam_attempts' => ['exam_id' => ['exams', 'cascade'], 'student_id' => ['students', 'cascade']],
        'exam_attempt_answers' => [
            'attempt_id' => ['exam_attempts', 'cascade'],
            'question_id' => ['exam_questions', 'cascade'],
        ],
        'meetings' => ['academic_year_id' => ['academic_years', 'cascade']],
        'meeting_classroom' => ['meeting_id' => ['meetings', 'cascade'], 'classroom_id' => ['classrooms', 'cascade']],
        'library_resources' => ['grade_id' => ['grades', 'cascade']],
        'library_resource_subject' => [
            'library_resource_id' => ['library_resources', 'cascade'],
            'subject_id' => ['subjects', 'cascade'],
        ],
    ];

    /** Globally unique today, per school from now on: table => column. */
    private const PER_SCHOOL_UNIQUES = [
        'academic_years' => 'year',
        'settings' => 'key',
        'teachers' => 'email',
    ];

    public function up(): void
    {
        foreach (self::TABLES as $name) {
            if (DB::table($name)->whereNull('school_id')->exists()) {
                throw new RuntimeException("{$name} has rows with no school_id — run the step 2 backfill first.");
            }

            Schema::table($name, function (Blueprint $table) {
                $table->unsignedBigInteger('school_id')->nullable(false)->change();
            });
        }

        // Composite keys need (school_id, id) to be unique on the referenced table.
        foreach ($this->referencedTables() as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->unique(['school_id', 'id']);
            });
        }

        foreach (self::FOREIGN_KEYS as $name => $keys) {
            Schema::table($name, function (Blueprint $table) use ($keys) {
                foreach ($keys as $column => [$on, $onDelete]) {
                    $table->dropForeign([$column]);
                    $table->foreign(['school_id', $column])
                        ->references(['school_id', 'id'])->on($on)
                        ->onDelete($onDelete);
                }
            });
        }

        foreach (self::PER_SCHOOL_UNIQUES as $name => $column) {
            Schema::table($name, function (Blueprint $table) use ($column) {
                $table->dropUnique([$column]);
                $table->unique(['school_id', $column]);
            });
        }
    }

    public function down(): void
    {
        // MySQL/MariaDB silently drop the automatic index behind the
        // school_id -> schools key once a composite index starting with
        // school_id exists, and then refuse to drop that composite index.
        // Give the key a plain index of its own first.
        foreach ([...self::TABLES, ...array_keys(self::PER_SCHOOL_UNIQUES)] as $name) {
            if (! $this->hasIndexOn($name, ['school_id'])) {
                Schema::table($name, function (Blueprint $table) {
                    $table->index('school_id');
                });
            }
        }

        foreach (self::PER_SCHOOL_UNIQUES as $name => $column) {
            Schema::table($name, function (Blueprint $table) use ($column) {
                $table->dropUnique(['school_id', $column]);
                $table->unique([$column]);
            });
        }

        foreach (self::FOREIGN_KEYS as $name => $keys) {
            Schema::table($name, function (Blueprint $table) use ($keys) {
                foreach ($keys as $column => [$on, $onDelete]) {
                    $table->dropForeign(['school_id', $column]);
                    $table->foreign($column)->references('id')->on($on)->onDelete($onDelete);
                }
            });
        }

        foreach ($this->referencedTables() as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->dropUnique(['school_id', 'id']);
            });
        }

        foreach (self::TABLES as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->unsignedBigInteger('school_id')->nullable()->change();
            });
        }
    }

    /** @param list<string> $columns */
    private function hasIndexOn(string $table, array $columns): bool
    {
        return collect(Schema::getIndexes($table))->contains(fn ($index) => $index['columns'] === $columns);
    }

    /** @return list<string> */
    private function referencedTables(): array
    {
        return collect(self::FOREIGN_KEYS)->flatten(1)->map(fn ($ref) => $ref[0])->unique()->values()->all();
    }
};
