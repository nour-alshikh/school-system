<?php

namespace App\Http\Resources;

use App\TypeScript\AcademicYearType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AcademicYearResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return (array) AcademicYearType::fromModel($this->resource);
    }
}
