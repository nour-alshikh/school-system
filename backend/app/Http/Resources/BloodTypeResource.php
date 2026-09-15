<?php

namespace App\Http\Resources;

use App\TypeScript\BloodTypeType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BloodTypeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return (array) BloodTypeType::fromModel($this->resource);
    }
}
