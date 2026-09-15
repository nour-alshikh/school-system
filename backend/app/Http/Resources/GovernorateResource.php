<?php

namespace App\Http\Resources;

use App\TypeScript\GovernorateType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GovernorateResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return (array) GovernorateType::fromModel($this->resource);
    }
}
