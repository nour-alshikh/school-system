<?php

namespace App\Http\Resources;

use App\TypeScript\PromotionType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PromotionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return (array) PromotionType::fromModel($this->resource);
    }
}
