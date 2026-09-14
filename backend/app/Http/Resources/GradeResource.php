<?php

namespace App\Http\Resources;

use App\TypeScript\GradeType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GradeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return (array) GradeType::fromModel($this->resource);
    }
}
