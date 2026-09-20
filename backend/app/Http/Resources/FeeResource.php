<?php

namespace App\Http\Resources;

use App\TypeScript\FeeType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FeeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return (array) FeeType::fromModel($this->resource);
    }
}
