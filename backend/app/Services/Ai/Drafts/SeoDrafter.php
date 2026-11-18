<?php

namespace App\Services\Ai\Drafts;

use App\Models\User;
use App\Services\Ai\Drafter;

/**
 * Settings → SEO (docs/ai-assistant-plan.md, phase 7): a few words about the
 * school, plus its name and tagline from the form → the meta title and
 * description search engines and link previews show. Only what the admin
 * typed goes out — no school records.
 */
class SeoDrafter extends Drafter
{
    public const TITLE_MAX = 70;

    public const DESCRIPTION_MAX = 200;

    protected int $maxTokens = 600;

    public function kind(): string
    {
        return 'seo';
    }

    public function authorize(User $user): bool
    {
        // Same as PUT /api/settings.
        return $user->can('manage-settings');
    }

    public function contextRules(): array
    {
        return [
            'school_name' => ['nullable', 'string', 'max:255'],
            'tagline' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
        ];
    }

    protected function prompt(): string
    {
        return <<<TXT
            You write search engine text for a school's public website. From the school's details and the notes, write:
            - meta_title: under 60 characters, the school's name first, then what it is and where (e.g. "Nile Valley School | Bilingual Primary School in Cairo").
            - meta_description: 120-155 characters, one or two plain sentences on what makes the school worth a parent's visit, ending with a gentle call to action. No made-up facts, awards or numbers; no quotes or emoji.
            {$this->sameLanguage()}
            Reply with JSON only, no other text: {"meta_title":"...","meta_description":"..."}
            TXT;
    }

    protected function message(string $notes, array $context): string
    {
        $details = collect([
            'School name' => $context['school_name'] ?? null,
            'Tagline' => $context['tagline'] ?? null,
            'Address' => $context['address'] ?? null,
        ])->filter(fn ($v) => filled($v))->map(fn ($v, $k) => "{$k}: {$v}")->implode("\n");

        return ($details !== '' ? "{$details}\n\n" : '')."Notes:\n{$notes}";
    }

    protected function shape(array $data): array
    {
        return [
            'meta_title' => $this->text($data, 'meta_title', self::TITLE_MAX, required: true),
            'meta_description' => $this->text($data, 'meta_description', self::DESCRIPTION_MAX, required: true),
        ];
    }
}
