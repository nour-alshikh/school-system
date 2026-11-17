<?php

namespace App\Services\Ai\Assistant\Tools;

use App\Models\Student;
use App\Services\Ai\Assistant\Lookup;
use App\Services\Ai\Assistant\Tool;
use App\Services\Ai\Assistant\ToolContext;

/**
 * "Show me Omar Khaled's profile" — up to 5 students by name, with a link
 * to each one's page. Same search as the students list; manage-students only.
 */
class FindStudent extends Tool
{
    public function name(): string
    {
        return 'find_student';
    }

    public function describe(): string
    {
        return 'find_student(name: string) — up to 5 students whose name matches, with their classroom and status, and links to their pages (details, fees).';
    }

    public function allows(ToolContext $context): bool
    {
        return $context->can('manage-students');
    }

    public function rules(): array
    {
        return ['name' => ['required', 'string', 'min:2', 'max:100']];
    }

    public function run(ToolContext $context, array $args): array
    {
        $escaped = addcslashes(trim($args['name']), '%_\\');

        $matches = Student::with('classroom.grade')
            ->where(fn ($q) => $q->where('name->en', 'like', "%{$escaped}%")->orWhere('name->ar', 'like', "%{$escaped}%"))
            ->orderBy('id')
            ->limit(5)
            ->get();

        return [
            'source' => 'student records',
            'students' => $matches->map(fn (Student $s) => [...Lookup::student($s), 'status' => $s->status->value])->all(),
            'links' => $matches->take(3)->map(fn (Student $s) => ['href' => "/students/{$s->id}", 'label' => Lookup::name($s)])->all(),
        ];
    }
}
