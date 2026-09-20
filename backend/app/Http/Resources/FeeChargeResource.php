<?php

namespace App\Http\Resources;

use App\TypeScript\FeeChargeType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FeeChargeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return (array) FeeChargeType::fromModel($this->resource);
    }
}
