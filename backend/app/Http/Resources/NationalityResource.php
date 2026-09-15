<?php

namespace App\Http\Resources;

use App\TypeScript\NationalityType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NationalityResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return (array) NationalityType::fromModel($this->resource);
    }
}
