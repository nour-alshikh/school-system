<?php

namespace App\Services\Ai\Drafts;

use App\Services\Ai\Drafter;

/**
 * The ✦ beside an empty language on a bilingual field (docs/ai-assistant-plan.md,
 * phase 3): the other language's text, written natively rather than word for
 * word. Any signed-in user of the school: the button only shows on forms
 * they can already save.
 */
class TranslateDrafter extends Drafter
{
    protected float $temperature = 0.2;

    protected int $maxTokens = 800;

    public function kind(): string
    {
        return 'translate';
    }

    public function contextRules(): array
    {
        return [
            'from' => ['required', 'in:en,ar'],
            // What the text is ("stage name", "fee name"), so terms come out right.
            'what' => ['nullable', 'string', 'max:50'],
        ];
    }

    protected function prompt(): string
    {
        return <<<'TXT'
            You translate short labels and texts for a school management system between English and Modern Standard Arabic.
            Write it the way a school in that language would say it, not word for word (e.g. "Grade 1" = "الصف الأول", "Primary" = "الابتدائية", "Tuition fee" = "الرسوم الدراسية"). Keep names of people and places, transliterated. Keep it about as long as the original.
            Reply with JSON only, no other text: {"text":"..."}
            TXT;
    }

    protected function message(string $notes, array $context): string
    {
        [$from, $to] = ($context['from'] ?? 'en') === 'ar' ? ['Arabic', 'English'] : ['English', 'Arabic'];
        $what = filled($context['what'] ?? null) ? " ({$context['what']})" : '';

        return "Translate from {$from} to {$to}{$what}:\n{$notes}";
    }

    protected function shape(array $data): array
    {
        return ['text' => $this->text($data, 'text', 2000, required: true)];
    }
}
