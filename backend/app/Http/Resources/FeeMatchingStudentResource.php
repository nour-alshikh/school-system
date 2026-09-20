<?php

namespace App\Http\Resources;

use App\TypeScript\FeeMatchingStudentType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FeeMatchingStudentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return (array) FeeMatchingStudentType::fromModel($this->resource);
    }
}
