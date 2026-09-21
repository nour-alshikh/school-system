<?php

namespace App\Http\Resources;

use App\TypeScript\MeetingType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MeetingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return (array) MeetingType::fromModel($this->resource);
    }
}
