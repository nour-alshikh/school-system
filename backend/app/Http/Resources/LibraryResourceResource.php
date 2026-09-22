<?php

namespace App\Http\Resources;

use App\TypeScript\LibraryResourceType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LibraryResourceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return (array) LibraryResourceType::fromModel($this->resource);
    }
}
