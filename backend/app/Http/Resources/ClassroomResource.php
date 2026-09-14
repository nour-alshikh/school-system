<?php

namespace App\Http\Resources;

use App\TypeScript\ClassroomType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ClassroomResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return (array) ClassroomType::fromModel($this->resource);
    }
}
