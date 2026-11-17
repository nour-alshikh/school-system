<?php

namespace App\Services\Ai\Drafts;

use App\Enums\AnnouncementLevel;
use App\Enums\MembershipRole;
use App\Services\Ai\Drafter;

/**
 * Turns a system admin's rough notes into an announcement draft in both
 * languages, with a level and audience. Only the notes are sent — no
 * school or user data. Served by the system admin's own route
 * (/api/platform/announcements/draft), not /api/ai/draft/{kind}.
 */
class AnnouncementDrafter extends Drafter
{
    public function kind(): string
    {
        return 'announcement';
    }

    protected function prompt(): string
    {
        return <<<'TXT'
            You write short announcements for a school management system. They are shown as a banner to admins, teachers, parents and students.
            From the notes you get, write a clear, friendly title (under 80 characters) and a message (1-3 sentences, under 400 characters), in both English and Modern Standard Arabic. The Arabic is written natively, not word-for-word translated.
            Pick a level: "info" for general news, "warning" for something people must take note of (downtime, deadlines, changes), "critical" only for urgent problems happening now. Match the tone to it: info is neutral, warning asks people to take note, critical is direct and urgent.
            Pick the audience: the roles the notes are meant for, from "admin", "teacher", "parent", "student". Use an empty list when it's for everyone or the notes don't say.
            Don't invent dates, times or details that aren't in the notes.
            Reply with JSON only, no other text: {"title":{"en":"...","ar":"..."},"body":{"en":"...","ar":"..."},"level":"info","audience":[]}
            TXT;
    }

    /**
     * The text is required; a bad level falls back to info and unknown roles are dropped.
     *
     * @return array{title: array{en: string, ar: string}, body: array{en: string, ar: string}, level: string, audience: list<string>}
     */
    protected function shape(array $data): array
    {
        return [
            'title' => $this->bilingual($data, 'title', 200),
            'body' => $this->bilingual($data, 'body', 2000),
            'level' => $this->enumValue($data['level'] ?? null, AnnouncementLevel::class, AnnouncementLevel::Info),
            'audience' => $this->enumList($data['audience'] ?? null, MembershipRole::class),
        ];
    }
}
