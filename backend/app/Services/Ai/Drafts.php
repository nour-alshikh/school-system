<?php

namespace App\Services\Ai;

/** The draft kinds POST /api/ai/draft/{kind} serves (config ai.drafts). */
class Drafts
{
    public function find(string $kind): ?Drafter
    {
        $class = config("ai.drafts.{$kind}");

        return is_string($class) && is_subclass_of($class, Drafter::class) ? app($class) : null;
    }
}
