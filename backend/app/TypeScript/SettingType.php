<?php

namespace App\TypeScript;

use App\Enums\SettingGroup;
use App\Models\Setting;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class SettingType
{
    public function __construct(
        public readonly int $id,
        public readonly string $key,
        public readonly ?string $value,
        public readonly SettingGroup $group,
        public readonly ?string $file_url,
    ) {}

    public static function fromModel(Setting $setting): self
    {
        return new self(
            id: $setting->id,
            key: $setting->key,
            value: $setting->value,
            group: $setting->group,
            file_url: $setting->getFirstMediaUrl('file') ?: null,
        );
    }
}
