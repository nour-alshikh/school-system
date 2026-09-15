<?php

namespace App\Http\Resources;

use App\TypeScript\StudentType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StudentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return (array) StudentType::fromModel($this->resource);
    }
}
