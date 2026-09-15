<?php

namespace App\TypeScript;

use App\Models\Father;
use App\Models\Mother;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class GuardianType
{
    public function __construct(
        public readonly string $name,
        public readonly string $job,
        public readonly string $national_id,
        public readonly string $phone,
        public readonly int $nationality_id,
        public readonly int $governorate_id,
        public readonly int $blood_type_id,
        public readonly int $religion_id,
        public readonly string $address,
    ) {}

    public static function fromModel(Father|Mother $guardian): self
    {
        return new self(
            name: $guardian->name,
            job: $guardian->job,
            national_id: $guardian->national_id,
            phone: $guardian->phone,
            nationality_id: $guardian->nationality_id,
            governorate_id: $guardian->governorate_id,
            blood_type_id: $guardian->blood_type_id,
            religion_id: $guardian->religion_id,
            address: $guardian->address,
        );
    }
}
