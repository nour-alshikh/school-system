<?php

namespace App\Http\Resources;

use App\TypeScript\ExamDetailType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ExamResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return (array) ExamDetailType::fromModel($this->resource);
    }
}
