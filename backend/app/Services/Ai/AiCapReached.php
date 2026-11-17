<?php

namespace App\Services\Ai;

use RuntimeException;

/** Today's AI calls are used up, for this user or this school (config ai.caps). */
class AiCapReached extends RuntimeException
{
    /** @param  'user'|'school'  $scope */
    public function __construct(public readonly string $scope)
    {
        parent::__construct("Daily AI cap reached for this {$scope}.");
    }
}
