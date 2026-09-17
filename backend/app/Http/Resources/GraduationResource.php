<?php

namespace App\Http\Resources;

use App\TypeScript\GraduationType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GraduationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return (array) GraduationType::fromModel($this->resource);
    }
}
