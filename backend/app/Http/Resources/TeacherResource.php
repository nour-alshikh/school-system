<?php

namespace App\Http\Resources;

use App\TypeScript\TeacherType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TeacherResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return (array) TeacherType::fromModel($this->resource);
    }
}
