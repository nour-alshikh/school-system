<?php

namespace App\Http\Resources;

use App\TypeScript\CalendarEventType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CalendarEventResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return (array) CalendarEventType::fromModel($this->resource);
    }
}
