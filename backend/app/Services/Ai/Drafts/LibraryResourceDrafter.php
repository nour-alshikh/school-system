<?php

namespace App\Services\Ai\Drafts;

use App\Models\Grade;
use App\Models\Subject;
use App\Models\User;
use App\Services\Ai\Drafter;

/**
 * Library (docs/ai-assistant-plan.md, phase 3): a resource's title and
 * notes → a description for students and parents, and the grade and
 * subjects it fits. The form sends the options it offers (the grades this
 * user may tag, or the chosen grade's subjects); suggestions come from those
 * only, and only ids that exist in this school survive.
 */
class LibraryResourceDrafter extends Drafter
{
    /** The request's context, for shape() to check suggestions against. */
    private array $context = [];

    public function kind(): string
    {
        return 'library_resource';
    }

    public function authorize(User $user): bool
    {
        // Same as the library routes: role_or_permission:teacher|manage-academics.
        return $user->can('manage-academics') || $user->hasRole('teacher');
    }

    public function planFeature(): ?string
    {
        return 'library';
    }

    public function contextRules(): array
    {
        return [
            'title' => ['nullable', 'string', 'max:255'],
            'grade_options' => ['nullable', 'array', 'max:50'],
            'grade_options.*' => ['integer'],
            'subject_options' => ['nullable', 'array', 'max:60'],
            'subject_options.*' => ['integer'],
        ];
    }

    public function draft(string $notes, array $context = []): array
    {
        $this->context = $context;

        return parent::draft($notes, $context);
    }

    protected function prompt(): string
    {
        return <<<TXT
            You describe resources in a school library (books, worksheets, videos, links). From the title and notes, write a description of 2-3 sentences for students and parents: what it is and what it helps with. Don't invent authors, page counts or facts that aren't given.
            If a list of grades is given, pick the one it fits best as grade_id (or null). If a list of subjects is given, pick the ones it fits as subject_ids (or []). Use only ids from those lists.
            {$this->sameLanguage()}
            Reply with JSON only, no other text: {"description":"...","grade_id":null,"subject_ids":[]}
            TXT;
    }

    protected function message(string $notes, array $context): string
    {
        $lines = [];
        if (filled($context['title'] ?? null)) {
            $lines[] = "Title: {$context['title']}";
        }
        if ($grades = $this->options(Grade::class, $context['grade_options'] ?? [])) {
            $lines[] = 'Grades: '.json_encode($grades, JSON_UNESCAPED_UNICODE);
        }
        if ($subjects = $this->options(Subject::class, $context['subject_options'] ?? [])) {
            $lines[] = 'Subjects: '.json_encode($subjects, JSON_UNESCAPED_UNICODE);
        }
        $lines[] = "Notes:\n{$notes}";

        return implode("\n", $lines);
    }

    protected function shape(array $data): array
    {
        $offered = fn (string $key) => array_map('intval', $this->context[$key] ?? []);
        $gradeIds = array_values(array_intersect($this->existingIds(Grade::class, [$data['grade_id'] ?? null]), $offered('grade_options')));
        $subjectIds = array_values(array_intersect($this->existingIds(Subject::class, $data['subject_ids'] ?? []), $offered('subject_options')));

        return [
            'description' => $this->text($data, 'description', 5000, required: true),
            'grade_id' => $gradeIds[0] ?? null,
            'subject_ids' => $subjectIds,
        ];
    }

    /**
     * {id: English name} for the ids that exist here.
     *
     * @param  class-string<Grade|Subject>  $model
     */
    private function options(string $model, array $ids): array
    {
        $ids = $this->existingIds($model, $ids);

        return $ids === [] ? [] : $model::whereKey($ids)->get()->mapWithKeys(fn ($m) => [$m->id => $m->getTranslation('name', 'en')])->all();
    }
}
