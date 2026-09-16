<?php

namespace App\Http\Resources;

use App\TypeScript\SubjectType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SubjectResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return (array) SubjectType::fromModel($this->resource);
    }
}
