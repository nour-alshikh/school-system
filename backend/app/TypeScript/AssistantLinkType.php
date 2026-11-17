<?php

namespace App\TypeScript;

use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/** A page an assistant answer points to. */
#[TypeScript]
final class AssistantLinkType
{
    public function __construct(
        public readonly string $href,
        /** The page's name as sent with the question, or what a lookup found (a student's name); may be empty. */
        public readonly string $label,
    ) {}
}
