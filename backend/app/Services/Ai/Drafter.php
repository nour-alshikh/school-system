<?php

namespace App\Services\Ai;

use App\Models\User;
use BackedEnum;
use Illuminate\Database\Eloquent\Model;
use RuntimeException;

/**
 * A "Draft with AI" kind (docs/ai-assistant-plan.md, phase 1): a prompt,
 * the JSON shape it asks for, and the PHP that validates the reply like a
 * request — required text in both languages, length limits, enums, ids
 * that must exist in this school. A draft fills a form for the user to
 * edit and save; it never saves anything (rule 1).
 *
 * A reply that can't be used throws a RuntimeException (the caller answers
 * "couldn't draft that"); a bad optional value falls back or is dropped
 * instead, so one odd field doesn't waste the whole draft.
 */
abstract class Drafter
{
    protected float $temperature = 0.4;

    /** Room for the reply; raise it for big shapes. */
    protected int $maxTokens = 1500;

    public function __construct(protected readonly AiClient $client) {}

    /** The {kind} in the URL and "draft.{kind}" in ai_usage. */
    abstract public function kind(): string;

    /** The system prompt, ending with the exact JSON shape to reply with. */
    abstract protected function prompt(): string;

    /**
     * The reply validated and trimmed to what the form takes.
     *
     * @throws RuntimeException when it isn't a usable draft
     */
    abstract protected function shape(array $data): array;

    /** Who may draft this kind: normally the permission the form itself needs. */
    public function authorize(User $user): bool
    {
        return true;
    }

    /** The plan feature the form belongs to (exams, meetings, library), when it has one. */
    public function planFeature(): ?string
    {
        return null;
    }

    /** Today, for prompts that turn "next Thursday" into a date. */
    protected function today(): string
    {
        return now()->format('l, Y-m-d');
    }

    /** "Write in the language of the notes" — most single-language fields follow the user. */
    protected function sameLanguage(): string
    {
        return 'Write in the same language as the notes (Modern Standard Arabic if they are in Arabic).';
    }

    /** Validation rules for the request's optional "context" (e.g. the exam's subject). */
    public function contextRules(): array
    {
        return [];
    }

    /** The user message: what they typed, plus any context. */
    protected function message(string $notes, array $context): string
    {
        return "Notes:\n{$notes}";
    }

    /** @throws RuntimeException */
    public function draft(string $notes, array $context = []): array
    {
        return $this->client->json(
            'draft.'.$this->kind(),
            $this->prompt(),
            $this->message($notes, $context),
            fn (array $data) => $this->shape($data),
            $this->temperature,
            $this->maxTokens,
        );
    }

    // Helpers for shape().

    /**
     * {en, ar} text, both required unless $required is false (then a
     * missing pair is null).
     *
     * @return array{en: string, ar: string}|null
     */
    protected function bilingual(array $data, string $field, int $max, bool $required = true): ?array
    {
        $pair = [];
        foreach (['en', 'ar'] as $lang) {
            $pair[$lang] = mb_substr(trim((string) (is_array($data[$field] ?? null) ? ($data[$field][$lang] ?? '') : '')), 0, $max);
        }

        if ($pair['en'] === '' || $pair['ar'] === '') {
            if ($required || $pair['en'] !== '' || $pair['ar'] !== '') {
                throw new RuntimeException("Draft is missing {$field}.".($pair['en'] === '' ? 'en' : 'ar'));
            }

            return null;
        }

        return $pair;
    }

    /** Plain text, trimmed and cut to $max; null when empty and not required. */
    protected function text(array $data, string $field, int $max, bool $required = false): ?string
    {
        $value = mb_substr(trim(is_scalar($data[$field] ?? null) ? (string) $data[$field] : ''), 0, $max);

        if ($value === '' && $required) {
            throw new RuntimeException("Draft is missing {$field}");
        }

        return $value === '' ? null : $value;
    }

    /**
     * An enum's value, or $default when missing or not one of its cases.
     *
     * @param  class-string<BackedEnum>  $enum
     */
    protected function enumValue(mixed $value, string $enum, BackedEnum $default): string|int
    {
        return (is_string($value) || is_int($value) ? $enum::tryFrom(is_string($value) ? strtolower($value) : $value) : null)?->value ?? $default->value;
    }

    /**
     * The values that are cases of $enum, distinct; anything else dropped.
     *
     * @param  class-string<BackedEnum>  $enum
     */
    protected function enumList(mixed $values, string $enum): array
    {
        return array_values(array_unique(array_filter(array_map(
            fn ($v) => is_string($v) || is_int($v) ? $enum::tryFrom(is_string($v) ? strtolower($v) : $v)?->value : null,
            is_array($values) ? $values : [],
        ), fn ($v) => $v !== null)));
    }

    /**
     * The ids that exist for $model in the current school (its school scope
     * applies), in the order given; the rest — invented, or another
     * school's — are dropped.
     *
     * @param  class-string<Model>  $model
     * @return list<int>
     */
    protected function existingIds(string $model, mixed $ids): array
    {
        $ids = array_values(array_unique(array_filter(
            array_map(fn ($id) => filter_var($id, FILTER_VALIDATE_INT), is_array($ids) ? $ids : []),
            fn ($id) => $id !== false && $id > 0,
        )));

        if ($ids === []) {
            return [];
        }

        $found = $model::query()->whereKey($ids)->pluck((new $model)->getKeyName())->map(fn ($id) => (int) $id)->all();

        return array_values(array_intersect($ids, $found));
    }
}
