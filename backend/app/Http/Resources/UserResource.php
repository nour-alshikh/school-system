<?php

namespace App\Http\Resources;

use App\Http\Middleware\ResolveSchool;
use App\Models\SchoolMembership;
use App\TypeScript\UserType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    /**
     * $membership: the membership this response is for. Defaults to the one
     * ResolveSchool resolved for this request, when this is the signed-in
     * user — pass it explicitly right after issuing a token (login/switch).
     */
    public function __construct($resource, private readonly ?SchoolMembership $membership = null)
    {
        parent::__construct($resource);
    }

    public function toArray(Request $request): array
    {
        return (array) UserType::fromModel($this->resource, $this->membership ?? $this->currentMembership($request));
    }

    private function currentMembership(Request $request): ?SchoolMembership
    {
        if (! $request->user()?->is($this->resource)) {
            return null;
        }

        return $request->attributes->get(ResolveSchool::MEMBERSHIP);
    }
}
