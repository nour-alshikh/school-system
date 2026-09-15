<?php

namespace App\Http\Resources;

use App\TypeScript\ReligionType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ReligionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return (array) ReligionType::fromModel($this->resource);
    }
}
