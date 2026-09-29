<?php

namespace App\Platform;

use Illuminate\Support\Facades\Schema;

/**
 * The tables holding a school's data: every table with a school_id column
 * except the platform's own records, which outlive a school on purpose.
 * Used by the export (what goes in the zip) and the purge (what to delete,
 * in an order the foreign keys accept). See docs/central-dashboard-plan.md,
 * phase 7.
 */
class SchoolTables
{
    /** Platform records, and tables handled separately (memberships, roles, media files). */
    private const EXCLUDED = ['audit_logs', 'school_exports', 'platform_sessions', 'school_memberships', 'model_has_roles', 'model_has_permissions', 'roles'];

    /** @return list<string> */
    public function all(): array
    {
        return collect(Schema::getTables())
            ->pluck('name')
            ->reject(fn (string $table) => in_array($table, self::EXCLUDED, true))
            ->filter(fn (string $table) => Schema::hasColumn($table, 'school_id'))
            ->sort()
            ->values()
            ->all();
    }

    /**
     * Children before parents, so deleting in this order never breaks a
     * foreign key. Built from the foreign keys among these tables (the
     * composite school keys included).
     *
     * @return list<string>
     */
    public function deletionOrder(): array
    {
        $tables = $this->all();

        // table => the tables it references (its parents), within the set.
        $parents = collect($tables)->mapWithKeys(fn (string $table) => [
            $table => collect(Schema::getForeignKeys($table))
                ->pluck('foreign_table')
                ->map(fn (string $t) => str_contains($t, '.') ? substr($t, strrpos($t, '.') + 1) : $t)
                ->filter(fn (string $t) => $t !== $table && in_array($t, $tables, true))
                ->unique()
                ->values()
                ->all(),
        ]);

        // Depth-first: parents are placed before their children, then the
        // whole list is reversed, so children are deleted first.
        $ordered = [];
        $visiting = [];
        $visit = function (string $table) use (&$visit, &$ordered, &$visiting, $parents) {
            if (in_array($table, $ordered, true) || isset($visiting[$table])) {
                return;
            }
            $visiting[$table] = true;
            foreach ($parents[$table] as $parent) {
                $visit($parent);
            }
            $ordered[] = $table;
        };

        foreach ($tables as $table) {
            $visit($table);
        }

        return array_reverse($ordered);
    }
}
