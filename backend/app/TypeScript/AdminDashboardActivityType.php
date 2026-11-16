<?php

namespace App\TypeScript;

use Spatie\TypeScriptTransformer\Attributes\LiteralTypeScriptType;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/**
 * One row of the dashboard's recent-activity feed. The frontend builds the
 * sentence from `type` ("Payment from {label}"), so the label is just the
 * subject's name, in both languages.
 */
#[TypeScript]
final class AdminDashboardActivityType
{
    public function __construct(
        #[LiteralTypeScriptType("'payment' | 'student' | 'exam'")]
        public readonly string $type,
        public readonly int $subject_id,
        public readonly string $label_en,
        public readonly string $label_ar,
        public readonly ?string $amount,
        public readonly string $at,
    ) {}
}
