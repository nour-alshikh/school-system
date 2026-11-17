<?php

namespace App\Services\Ai\Assistant;

use Illuminate\Support\Facades\File;

/**
 * The assistant's knowledge of how the app works (docs/ai-assistant-plan.md,
 * phase 4): one short markdown page per feature in resources/help/{en,ar},
 * with a front matter block:
 *
 *     ---
 *     title: Taking attendance
 *     pages: /attendance, /attendance/history
 *     access: manage-attendance, role:teacher
 *     feature: exams
 *     keywords: absent, present, late
 *     ---
 *
 * Small enough to send the few relevant pages with each question, picked by
 * the current page and a plain keyword match — no vector search. A page the
 * user may not read (access, plan feature) is never picked.
 */
class HelpLibrary
{
    /** Pages sent with a question, besides the overview. */
    public const MAX_PAGES = 3;

    /** Read on every question; always sent when the user may read it. */
    public const OVERVIEW = 'overview';

    /** @var array<string, list<HelpPage>> by locale */
    private array $loaded = [];

    public function __construct(private readonly ?string $path = null) {}

    /** @return list<HelpPage> */
    public function all(string $locale): array
    {
        $locale = in_array($locale, ['en', 'ar'], true) ? $locale : 'en';

        return $this->loaded[$locale] ??= $this->load($locale);
    }

    /**
     * The overview plus the pages that best fit the question and the page the
     * user is on, among those they may read.
     *
     * @param  list<string>  $roles
     * @param  list<string>  $permissions
     * @param  list<string>|null  $features
     * @return list<HelpPage>
     */
    public function relevant(string $locale, string $question, ?string $currentPage, array $roles, array $permissions, ?array $features): array
    {
        $readable = array_values(array_filter(
            $this->all($locale),
            fn (HelpPage $page) => $page->readableBy($roles, $permissions, $features),
        ));

        $words = self::words($question);
        $scored = [];

        foreach ($readable as $page) {
            if ($page->key === self::OVERVIEW) {
                continue;
            }

            $score = 0;
            foreach ($page->pages as $path) {
                if ($currentPage !== null && ($currentPage === $path || str_starts_with($currentPage, rtrim($path, '/').'/'))) {
                    $score += 5;
                }
            }

            // Word by word, so "take attendance" matches a question about "attendance".
            $terms = self::words(implode(' ', $page->keywords).' '.$page->title);
            foreach ($words as $word) {
                foreach ($terms as $term) {
                    if (self::matches($word, $term)) {
                        $score += 2;
                        break;
                    }
                }
            }

            if ($score > 0) {
                $scored[] = [$score, $page];
            }
        }

        usort($scored, fn ($a, $b) => $b[0] <=> $a[0]);
        $picked = array_map(fn ($entry) => $entry[1], array_slice($scored, 0, self::MAX_PAGES));

        $overview = array_values(array_filter($readable, fn (HelpPage $page) => $page->key === self::OVERVIEW));

        return [...$overview, ...$picked];
    }

    /** @return list<string> lowercased words of 3+ letters, without Arabic's "ال" */
    public static function words(string $text): array
    {
        preg_match_all('/[\p{L}\p{N}]{3,}/u', mb_strtolower($text), $matches);

        return array_values(array_unique(array_map(self::normalize(...), $matches[0])));
    }

    /** "الحضور" and "حضور" are the same word here. */
    private static function normalize(string $word): string
    {
        return preg_replace('/^ال(?=\p{L}{3,})/u', '', mb_strtolower(trim($word)));
    }

    /**
     * Same word, or one starts the other when both are 4+ letters:
     * "classrooms" matches "classroom", "attend" matches "attendance",
     * but "the" doesn't match "theme".
     */
    private static function matches(string $word, string $term): bool
    {
        if ($word === $term) {
            return true;
        }

        return min(mb_strlen($word), mb_strlen($term)) >= 4 && (str_starts_with($term, $word) || str_starts_with($word, $term));
    }

    /** @return list<HelpPage> */
    private function load(string $locale): array
    {
        $dir = ($this->path ?? resource_path('help')).DIRECTORY_SEPARATOR.$locale;
        if (! File::isDirectory($dir)) {
            return [];
        }

        $pages = [];
        foreach (File::files($dir) as $file) {
            if ($file->getExtension() === 'md' && ($page = self::parse($file->getFilenameWithoutExtension(), $file->getContents()))) {
                $pages[] = $page;
            }
        }

        usort($pages, fn (HelpPage $a, HelpPage $b) => strcmp($a->key, $b->key));

        return $pages;
    }

    public static function parse(string $key, string $contents): ?HelpPage
    {
        $contents = str_replace("\r\n", "\n", $contents);
        if (! preg_match('/\A---\n(.*?)\n---\n(.*)\z/s', $contents, $m)) {
            return null;
        }

        $meta = [];
        foreach (explode("\n", $m[1]) as $line) {
            if (str_contains($line, ':')) {
                [$name, $value] = explode(':', $line, 2);
                $meta[trim($name)] = trim($value);
            }
        }

        $list = fn (string $name) => array_values(array_filter(array_map('trim', explode(',', $meta[$name] ?? '')), 'strlen'));

        return new HelpPage(
            key: $key,
            title: $meta['title'] ?? $key,
            pages: $list('pages'),
            access: $list('access'),
            feature: ($meta['feature'] ?? '') ?: null,
            keywords: $list('keywords'),
            body: trim($m[2]),
        );
    }
}
