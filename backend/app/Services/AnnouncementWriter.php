<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Turns a system admin's rough notes into an announcement draft in both
 * languages, through OpenRouter (services.openrouter). Only the notes are
 * sent — no school or user data. The draft is shown for editing, never
 * saved as is.
 *
 * The free model doesn't support response_format, so the reply is asked
 * for as JSON in the prompt and parsed leniently.
 */
class AnnouncementWriter
{
    private const PROMPT = <<<'TXT'
        You write short announcements for a school management system. They are shown as a banner to admins, teachers, parents and students.
        From the notes you get, write a clear, friendly title (under 80 characters) and a message (1-3 sentences, under 400 characters), in both English and Modern Standard Arabic. The Arabic is written natively, not word-for-word translated.
        Match the tone to the level: info is neutral, warning asks people to take note, critical is direct and urgent.
        Don't invent dates, times or details that aren't in the notes.
        Reply with JSON only, no other text: {"title":{"en":"...","ar":"..."},"body":{"en":"...","ar":"..."}}
        TXT;

    public function isConfigured(): bool
    {
        return filled(config('services.openrouter.key'));
    }

    /**
     * @return array{title: array{en: string, ar: string}, body: array{en: string, ar: string}}
     *
     * @throws RuntimeException when the model can't be reached or its reply isn't a draft
     */
    public function draft(string $notes, string $level): array
    {
        try {
            $response = Http::withToken(config('services.openrouter.key'))
                ->withHeaders(['X-Title' => config('app.name')])
                ->timeout(60)
                ->post('https://openrouter.ai/api/v1/chat/completions', [
                    'model' => config('services.openrouter.model'),
                    'messages' => [
                        ['role' => 'system', 'content' => self::PROMPT],
                        ['role' => 'user', 'content' => "Level: {$level}\nNotes:\n{$notes}"],
                    ],
                    'temperature' => 0.4,
                    'max_tokens' => 1500,
                    // A reasoning model: keep the thinking short and out of the reply.
                    'reasoning' => ['effort' => 'low', 'exclude' => true],
                ]);
        } catch (ConnectionException $e) {
            throw new RuntimeException('OpenRouter unreachable: '.$e->getMessage(), previous: $e);
        }

        if ($response->failed()) {
            throw new RuntimeException("OpenRouter returned {$response->status()}: ".$response->body());
        }

        return $this->parse((string) $response->json('choices.0.message.content'));
    }

    /** The first {...} in the reply, so code fences or stray text around it don't matter. */
    private function parse(string $content): array
    {
        $start = strpos($content, '{');
        $end = strrpos($content, '}');
        $data = $start !== false && $end > $start ? json_decode(substr($content, $start, $end - $start + 1), true) : null;

        $draft = [];
        foreach (['title' => 200, 'body' => 2000] as $field => $max) {
            foreach (['en', 'ar'] as $lang) {
                $value = trim((string) ($data[$field][$lang] ?? ''));
                if ($value === '') {
                    throw new RuntimeException("Draft is missing {$field}.{$lang}: {$content}");
                }
                $draft[$field][$lang] = mb_substr($value, 0, $max);
            }
        }

        return $draft;
    }
}
