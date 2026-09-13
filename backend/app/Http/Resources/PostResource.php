<?php

namespace App\Http\Resources;

use App\TypeScript\PostType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PostResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return (array) PostType::fromModel($this->resource);
    }
}
